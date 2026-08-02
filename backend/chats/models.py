"""
Database models for the chats app.
Contains models for ChatThread, ChatMessage, UploadedDocument,
DocumentChunk, PasswordResetOTP, and UserToken.
"""
# pylint: disable=no-member,too-few-public-methods

import uuid
from django.db import models
from django.contrib.auth.models import User

class ChatThread(models.Model):
    """
    Represents a conversational thread session.
    Belongs optionally to a User.
    """
    user = models.ForeignKey(
        User, related_name='threads', on_delete=models.CASCADE, null=True, blank=True
    )
    title = models.CharField(max_length=255, default="New Chat")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        """Meta options for ChatThread."""
        ordering = ['-updated_at']

    def __str__(self):
        """String representation showing thread title."""
        return str(self.title)

class ChatMessage(models.Model):
    """
    Logs chat messages within a thread.
    Each message has a role (user or assistant).
    """
    ROLE_CHOICES = [
        ('user', 'User'),
        ('assistant', 'Assistant'),
    ]
    thread = models.ForeignKey(ChatThread, related_name='messages', on_delete=models.CASCADE)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        """Meta options for ChatMessage."""
        ordering = ['created_at']

    def __str__(self):
        """String representation displaying snippet of message."""
        role_str = str(self.role).capitalize()
        content_str = str(self.content)[:30]
        return f"{role_str}: {content_str}..."

class UploadedDocument(models.Model):
    """
    Represents metadata for files uploaded to a thread.
    """
    thread = models.ForeignKey(ChatThread, related_name='documents', on_delete=models.CASCADE)
    file_name = models.CharField(max_length=255)
    file = models.FileField(upload_to='documents/')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        """String representation showing file name."""
        return str(self.file_name)

class DocumentChunk(models.Model):
    """
    Slices of documents indexed in MySQL with pre-generated embeddings.
    """
    document = models.ForeignKey(UploadedDocument, related_name='chunks', on_delete=models.CASCADE)
    content = models.TextField()
    embedding_json = models.TextField()  # Serialized float array

    def __str__(self):
        """String representation of chunk id."""
        doc_name = str(self.document.file_name)
        return f"Chunk {self.id} for {doc_name}"

class PasswordResetOTP(models.Model):
    """
    Stores 6-digit verification codes for forgotten passwords.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    otp = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    is_verified = models.BooleanField(default=False)

    def __str__(self):
        """String representation of OTP status."""
        username_str = str(self.user.username)
        return f"OTP for {username_str} - Verified: {self.is_verified}"

class UserToken(models.Model):
    """
    Simple custom token auth model for user sessions.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    token = models.CharField(max_length=64, unique=True, default=uuid.uuid4)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        """String representation showing username."""
        username_str = str(self.user.username)
        return f"Token for {username_str}"
