"""
API views for the chats app.
Handles chat thread operations, document uploads, RAG matching,
and user authentication workflows (register, login, forgot password OTP).
"""

# pylint: disable=no-member,too-many-locals
# pylint: disable=too-many-return-statements,too-many-branches
# pylint: disable=broad-exception-caught

import os
import io
import json
import logging
import random
import traceback
from django.shortcuts import get_object_or_404
from django.conf import settings
from django.contrib.auth.models import User
from django.core.mail import send_mail
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from pypdf import PdfReader
import google.generativeai as genai
import requests

# pyrefly: ignore [missing-import]
from .models import (
    ChatThread, ChatMessage, UploadedDocument,
    DocumentChunk, PasswordResetOTP, UserToken
)

logger = logging.getLogger(__name__)

# Initialize Gemini API Configuration
def configure_gemini():
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key or api_key == "your_gemini_api_key_here":
        raise ValueError(
            "Gemini API Key is not configured. "
            "Please add a valid GEMINI_API_KEY to backend/.env"
        )
    genai.configure(api_key=api_key)

# Helper: Safely extract flat float list from Gemini embedding response
def extract_embedding_vector(raw_emb):
    if not raw_emb:
        return []
    if isinstance(raw_emb, dict):
        if 'values' in raw_emb:
            return [float(x) for x in raw_emb['values']]
        if 'embedding' in raw_emb:
            return extract_embedding_vector(raw_emb['embedding'])
    elif isinstance(raw_emb, list):
        if len(raw_emb) > 0 and isinstance(raw_emb[0], (int, float)):
            return [float(x) for x in raw_emb]
        elif len(raw_emb) > 0 and isinstance(raw_emb[0], dict):
            return extract_embedding_vector(raw_emb[0])
        elif len(raw_emb) > 0 and isinstance(raw_emb[0], list):
            return extract_embedding_vector(raw_emb[0])
    return []

# Helper: Chunk Text
def chunk_text(text, chunk_size=800, overlap=150):
    chunks = []
    start = 0
    text_len = len(text)

    if text_len == 0:
        return []

    while start < text_len:
        end = min(start + chunk_size, text_len)
        chunk = text[start:end]
        chunks.append(chunk.strip())
        start += chunk_size - overlap
        if start >= text_len or end == text_len:
            break
    return [c for c in chunks if c]

# Helper: Cosine Similarity
def cosine_similarity(vec1, vec2):
    v1 = extract_embedding_vector(vec1) if not (isinstance(vec1, list) and vec1 and isinstance(vec1[0], (int, float))) else vec1
    v2 = extract_embedding_vector(vec2) if not (isinstance(vec2, list) and vec2 and isinstance(vec2[0], (int, float))) else vec2
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0
    dot = sum(a * b for a, b in zip(v1, v2))
    norm_a = sum(a * a for a in v1) ** 0.5
    norm_b = sum(b * b for b in v2) ** 0.5
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot / (norm_a * norm_b)

# Helper: Get Authenticated User
def get_authenticated_user(request):
 
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Token '):
        return None

    parts = auth_header.split(' ')
    if len(parts) != 2:
        return None

    token_str = parts[1]
    try:
        token_obj = UserToken.objects.get(token=token_str)
        return token_obj.user
    except UserToken.DoesNotExist:
        return None

# ----------------- Authentication Endpoints -----------------

@api_view(['POST'])
def auth_register(request):
    try:
        username = request.data.get('username', '').strip()
        email = request.data.get('email', '').strip()
        password = request.data.get('password', '').strip()

        if not username or not email or not password:
            return Response(
                {'error': 'Username, email, and password are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if User.objects.filter(username=username).exists():
            return Response(
                {'error': 'Username is already taken.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if User.objects.filter(email=email).exists():
            return Response(
                {'error': 'Email is already registered.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password
        )
        token_obj = UserToken.objects.create(user=user)
        return Response({
            'message': 'Registration successful!',
            'token': str(token_obj.token),
            'username': user.username
        }, status=status.HTTP_201_CREATED)
    except Exception as err:
        logger.error(f"Registration error: {err}", exc_info=True)
        return Response(
            {'error': f'Registration failed: {str(err)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
def auth_login(request):
    """
    POST: Login verification, returns a session token on success.
    """
    try:
        username_or_email = request.data.get('username', '').strip()
        password = request.data.get('password', '').strip()

        if not username_or_email or not password:
            return Response(
                {'error': 'Username/Email and password are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Resolve by username or email
        user = User.objects.filter(username=username_or_email).first()
        if not user:
            user = User.objects.filter(email=username_or_email).first()

        if not user or not user.check_password(password):
            return Response(
                {'error': 'Invalid credentials.'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # Get or create token to allow concurrent sessions across multiple devices
        token_obj, _ = UserToken.objects.get_or_create(user=user)

        return Response({
            'message': 'Login successful!',
            'token': str(token_obj.token),
            'username': user.username
        })
    except Exception as err:
        logger.error(f"Login error: {err}", exc_info=True)
        return Response(
            {'error': f'Login failed: {str(err)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
def auth_request_otp(request):
    """
    POST: Requests a 6-digit OTP for password resetting.
    """
    try:
        username_or_email = request.data.get('username', '').strip()
        if not username_or_email:
            return Response(
                {'error': 'Username or email is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = User.objects.filter(username=username_or_email).first()
        if not user:
            user = User.objects.filter(email=username_or_email).first()

        if not user:
            return Response(
                {'error': 'No user found with the provided username/email.'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Generate 6-digit OTP code
        otp_code = str(random.randint(100000, 999999))

        # Save code to DB
        PasswordResetOTP.objects.filter(user=user).delete()  # Clear older codes
        PasswordResetOTP.objects.create(user=user, otp=otp_code)

        # Try sending email (Resend API for Render to bypass SMTP blocking, fallback to send_mail)
        resend_api_key = os.getenv('RESEND_API_KEY')
        if resend_api_key:
            try:
                res = requests.post(
                    "https://api.resend.com/emails",
                    headers={
                        "Authorization": f"Bearer {resend_api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "from": "no-reply@chatdocgpt.online",
                        "to": user.email,
                        "subject": "Your Password Reset Verification Code",
                        "html": (
                            f"<p>Hi {user.username},</p>"
                            f"<p>Your 6-digit OTP code is: <strong>{otp_code}</strong></p>"
                            "<p>Please enter this code in the app to reset your password.</p>"
                            "<p>Regards,<br>Gemini Workspace Team</p>"
                        )
                    },
                    timeout=10
                )
                print(f"--- RESEND API RESPONSE: {res.status_code} - {res.text} ---")
            except Exception as resend_err:
                print(f"--- RESEND EMAIL SENDING EXCEPTION: {str(resend_err)} ---")
        else:
            try:
                from_email = (
                    getattr(settings, 'DEFAULT_FROM_EMAIL', None)
                    or 'noreply@workspace.com'
                )
                send_mail(
                    subject='Your Password Reset Verification Code',
                    message=(
                        f'Hi {user.username},\n\n'
                        f'Your 6-digit OTP code is: {otp_code}\n\n'
                        f'Please enter this code in the app to reset your password.\n\n'
                        f'Regards,\nGemini Workspace Team'
                    ),
                    from_email=from_email,
                    recipient_list=[user.email],
                    fail_silently=False,
                )
            except Exception as mail_err:
                print(f"--- EMAIL SENDING EXCEPTION: {str(mail_err)} ---")

        # Print to console for development debug
        print(f"\n--- SECURITY RESET PASSWORD OTP FOR {user.username}: {otp_code} ---\n")

        return Response({
            'message': 'Verification code sent successfully!',
            'otp_debug': otp_code  # Sent in payload for seamless local testing
        })
    except Exception as err:
        tb_str = traceback.format_exc()
        return Response(
            {
                'error': f'Failed to request OTP: {str(err)}',
                'traceback': tb_str
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
def auth_verify_otp(request):
    """
    POST: Verifies the 6-digit OTP code.
    """
    username_or_email = request.data.get('username', '').strip()
    otp_code = request.data.get('otp', '').strip()

    if not username_or_email or not otp_code:
        return Response(
            {'error': 'Username/Email and OTP code are required.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    user = User.objects.filter(username=username_or_email).first()
    if not user:
        user = User.objects.filter(email=username_or_email).first()

    if not user:
        return Response(
            {'error': 'User not found.'},
            status=status.HTTP_404_NOT_FOUND
        )

    otp_record = PasswordResetOTP.objects.filter(user=user, otp=otp_code).first()
    if not otp_record:
        return Response(
            {'error': 'Invalid verification code.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Mark OTP session as verified
    otp_record.is_verified = True
    otp_record.save()

    return Response({
        'message': 'Code verified successfully! You may now reset your password.',
        'otp_token': otp_record.id
    })

@api_view(['POST'])
def auth_reset_password(request):
    """
    POST: Resets user password once OTP token is verified.
    """
    otp_token_id = request.data.get('otp_token', '')
    new_password = request.data.get('password', '').strip()

    if not otp_token_id or not new_password:
        return Response(
            {'error': 'Verification context token and new password are required.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    otp_record = PasswordResetOTP.objects.filter(id=otp_token_id).first()
    if not otp_record or not otp_record.is_verified:
        return Response(
            {'error': 'Verification session is invalid or has expired.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    user = otp_record.user
    user.set_password(new_password)
    user.save()

    # Clear OTP
    otp_record.delete()

    return Response({
        'message': 'Password reset successful! You may now login.'
    })

# ----------------- Chat API Endpoints -----------------

@api_view(['GET', 'POST'])
def threads_list_create(request):
    """
    GET: List all chat threads for the logged-in user.
    POST: Create a new chat thread associated with the user.
    """
    user = get_authenticated_user(request)
    if not user:
        return Response(
            {'error': 'Authentication credentials were not provided.'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    if request.method == 'GET':
        threads = ChatThread.objects.filter(user=user)
        data = []
        for thread in threads:
            docs = thread.documents.all()
            doc_names = ", ".join([d.file_name for d in docs])
            data.append({
                'id': thread.id,
                'title': thread.title,
                'created_at': thread.created_at,
                'updated_at': thread.updated_at,
                'document_name': doc_names if docs.exists() else None
            })
        return Response(data)

    thread = ChatThread.objects.create(user=user)
    return Response({
        'id': thread.id,
        'title': thread.title,
        'created_at': thread.created_at,
        'updated_at': thread.updated_at,
        'document_name': None
    }, status=status.HTTP_201_CREATED)

@api_view(['GET'])
def thread_messages_list(request, thread_id):
    """
    GET: Get all messages in a specific thread, ensuring ownership.
    """
    user = get_authenticated_user(request)
    if not user:
        return Response(
            {'error': 'Authentication credentials were not provided.'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    thread = get_object_or_404(ChatThread, id=thread_id, user=user)
    messages = thread.messages.all()

    message_data = [{
        'id': msg.id,
        'role': msg.role,
        'content': msg.content,
        'created_at': msg.created_at
    } for msg in messages]

    docs = thread.documents.all()
    documents_data = [{
        'id': doc.id,
        'file_name': doc.file_name,
        'uploaded_at': doc.uploaded_at
    } for doc in docs]

    return Response({
        'thread_id': thread.id,
        'title': thread.title,
        'documents': documents_data,
        'messages': message_data
    })

@api_view(['POST'])
def upload_document(request, thread_id):
    """
    POST: Upload, parse, chunk, and embed documents for a thread.
    """
    user = get_authenticated_user(request)
    if not user:
        return Response(
            {'error': 'Authentication credentials were not provided.'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    thread = get_object_or_404(ChatThread, id=thread_id, user=user)
    uploaded_file = request.FILES.get('file')
    if not uploaded_file:
        return Response(
            {'error': 'No file uploaded.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    ext = os.path.splitext(uploaded_file.name)[1].lower()
    if ext not in ['.pdf', '.txt']:
        return Response(
            {'error': 'Unsupported file type. Only .pdf and .txt are supported.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        configure_gemini()
    except ValueError as err:
        return Response(
            {'error': str(err)},
            status=status.HTTP_400_BAD_REQUEST
        )

    os.makedirs(settings.MEDIA_ROOT, exist_ok=True)
    doc = UploadedDocument.objects.create(
        thread=thread,
        file_name=uploaded_file.name,
        file=uploaded_file
    )

    text_content = ""
    try:
        if ext == '.pdf':
            uploaded_file.seek(0)
            reader = PdfReader(io.BytesIO(uploaded_file.read()))
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text_content += page_text + "\n"
        elif ext == '.txt':
            uploaded_file.seek(0)
            text_content = uploaded_file.read().decode('utf-8', errors='ignore')
    except Exception as err:
        logger.warning(f"BytesIO extraction failed: {err}. Falling back to file path.")
        try:
            if ext == '.pdf':
                reader = PdfReader(doc.file.path)
                for page in reader.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text_content += page_text + "\n"
            elif ext == '.txt':
                with open(doc.file.path, 'r', encoding='utf-8', errors='ignore') as file_obj:
                    text_content = file_obj.read()
        except Exception as inner_err:
            doc.delete()
            return Response(
                {'error': f'Failed to parse file: {str(inner_err)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

    if not text_content.strip():
        doc.delete()
        return Response(
            {'error': 'The uploaded file is empty or contains no readable text.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    chunks = chunk_text(text_content)
    if not chunks:
        doc.delete()
        return Response(
            {'error': 'Failed to partition the document into chunks.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Safely index each chunk with embedding
    for idx, chunk in enumerate(chunks):
        emb_vector = []
        try:
            res = genai.embed_content(
                model="models/gemini-embedding-001",
                content=chunk
            )
            emb_vector = extract_embedding_vector(res.get('embedding', res))
        except Exception as emb_err:
            logger.warning(f"Embedding failed for chunk {idx}: {emb_err}")
            emb_vector = []

        DocumentChunk.objects.create(
            document=doc,
            content=chunk,
            embedding_json=json.dumps(emb_vector)
        )

    # Save a status message indicating document upload in the chat history
    ChatMessage.objects.create(
        thread=thread,
        role='user',
        content=f"📄 [Document Uploaded: {uploaded_file.name}]"
    )

    return Response({
        'message': 'File uploaded and indexed successfully!',
        'document': {
            'id': doc.id,
            'file_name': doc.file_name,
            'uploaded_at': doc.uploaded_at
        }
    }, status=status.HTTP_201_CREATED)

@api_view(['POST'])
def send_message(request, thread_id):
    """
    POST: Send user message, execute RAG search if document present,
          or use general Gemini chat otherwise.
    """
    user = get_authenticated_user(request)
    if not user:
        return Response(
            {'error': 'Authentication credentials were not provided.'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    thread = get_object_or_404(ChatThread, id=thread_id, user=user)
    user_content = request.data.get('content', '').strip()
    chat_mode = request.data.get('mode', 'ai').strip().lower()

    if not user_content:
        return Response(
            {'error': 'Message content is required.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        configure_gemini()
    except ValueError as err:
        return Response(
            {'error': str(err)},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Save User message
    ChatMessage.objects.create(
        thread=thread,
        role='user',
        content=user_content
    )

    if thread.title == "New Chat":
        clean_content = user_content.strip()
        if not clean_content.startswith("📄 [Document Uploaded:"):
            title_suggestion = clean_content[:40] + ("..." if len(clean_content) > 40 else "")
            thread.title = title_suggestion
            thread.save()

    docs = thread.documents.all()

    try:
        if chat_mode == 'doc':
            if not docs.exists():
                return Response(
                    {'error': 'Please upload a document to proceed in Document mode.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 1. RAG Mode
            query_embedding = []
            try:
                query_response = genai.embed_content(
                    model="models/gemini-embedding-001",
                    content=user_content
                )
                query_embedding = extract_embedding_vector(query_response.get('embedding', query_response))
            except Exception as q_err:
                logger.warning(f"Query embedding error: {q_err}")

            chunks = DocumentChunk.objects.filter(document__in=docs)

            scored_chunks = []
            for chunk in chunks:
                chunk_emb = json.loads(chunk.embedding_json or "[]")
                sim = cosine_similarity(query_embedding, chunk_emb) if query_embedding and chunk_emb else 0.0

                # Keyword overlap boost to ensure relevance
                user_keywords = [w.lower() for w in user_content.split() if len(w) > 3]
                if user_keywords:
                    overlap_count = sum(1 for kw in user_keywords if kw in chunk.content.lower())
                    sim += (overlap_count / len(user_keywords)) * 0.5

                scored_chunks.append((sim, chunk.content))

            scored_chunks.sort(key=lambda x: x[0], reverse=True)
            top_chunks = scored_chunks[:3]

            context_text = "\n\n".join([chunk[1] for chunk in top_chunks if chunk[1]])
            if not context_text.strip():
                context_text = "\n\n".join([c.content for c in chunks[:3]])

            system_prompt = (
                "You are an assistant trained to answer questions about the "
                "uploaded document. You must strictly and only use the provided "
                "document context to answer the user's question. If the answer "
                "cannot be found in the context, respond with exactly: "
                "'I cannot find the answer in the uploaded document.' "
                "Do not use any external knowledge to answer, and do not make things up."
            )
            user_prompt = f"Document Context:\n{context_text}\n\nQuestion: {user_content}"

            model = genai.GenerativeModel(
                model_name="gemini-2.5-flash",
                system_instruction=system_prompt
            )
            completion_response = model.generate_content(user_prompt)
            try:
                assistant_content = completion_response.text
            except Exception:
                if completion_response.candidates and completion_response.candidates[0].content.parts:
                    assistant_content = completion_response.candidates[0].content.parts[0].text
                else:
                    assistant_content = "I could not generate an answer from the document context."

        else:
            # 2. General Chat Mode
            history_messages = thread.messages.all().order_by('created_at')
            contents = []

            for msg in history_messages:
                if msg.content.startswith("📄 [Document Uploaded:"):
                    continue

                role = "user" if msg.role == "user" else "model"
                # Ensure strict alternation: do not append consecutive messages with the same role
                if contents and contents[-1]["role"] == role:
                    contents[-1]["parts"][0] += "\n" + msg.content
                else:
                    contents.append({
                        "role": role,
                        "parts": [msg.content]
                    })

            # Gemini requires the conversation to start with a user message
            while contents and contents[0]["role"] != "user":
                contents.pop(0)

            if not contents:
                contents = [{"role": "user", "parts": [user_content]}]

            model = genai.GenerativeModel(
                model_name="gemini-2.5-flash",
                system_instruction="You are a helpful and intelligent AI assistant."
            )
            completion_response = model.generate_content(contents)
            try:
                assistant_content = completion_response.text
            except Exception:
                if completion_response.candidates and completion_response.candidates[0].content.parts:
                    assistant_content = completion_response.candidates[0].content.parts[0].text
                else:
                    assistant_content = "I could not generate a response. Please try rephrasing your prompt."

        # Save Assistant message
        assistant_message = ChatMessage.objects.create(
            thread=thread,
            role='assistant',
            content=assistant_content
        )

        return Response({
            'message': {
                'id': assistant_message.id,
                'role': assistant_message.role,
                'content': assistant_message.content,
                'created_at': assistant_message.created_at
            },
            'thread_title': thread.title
        })

    except Exception as err:
        logger.error(f"Error in send_message: {err}", exc_info=True)
        return Response(
            {'error': f'Assistant failed to respond: {str(err)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['DELETE'])
def delete_document(request, thread_id):
    """
    DELETE: Detach/delete all documents from a thread.
    """
    user = get_authenticated_user(request)
    if not user:
        return Response(
            {'error': 'Authentication credentials were not provided.'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    thread = get_object_or_404(ChatThread, id=thread_id, user=user)
    docs = thread.documents.all()
    if docs.exists():
        docs.delete()
        return Response({'message': 'Documents detached successfully!'})
    return Response(
        {'error': 'No document found for this chat.'},
        status=status.HTTP_404_NOT_FOUND
    )


@api_view(['DELETE'])
def delete_thread(request, thread_id):
    """
    DELETE: Delete a chat thread and all associated messages/documents.
    """
    user = get_authenticated_user(request)
    if not user:
        return Response(
            {'error': 'Authentication credentials were not provided.'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    thread = get_object_or_404(ChatThread, id=thread_id, user=user)
    thread.delete()
    return Response({'message': 'Thread deleted successfully.'})
