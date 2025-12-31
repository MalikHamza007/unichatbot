import { Component, ChangeDetectionStrategy, inject, signal, ElementRef, viewChild, OnInit, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiCallService } from '../../../core/services/api-call.service';
import { Loading } from '../loading/loading';

export interface Message {
  id: string;
  content: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

export interface ChatResponse {
  message?: string;
  response?: string;
  session_id?: string;
}

export interface HistoryResponse {
  messages?: Array<{
    role: string;
    content: string;
    timestamp?: string;
  }>;
}

const AI_MODELS: string[] = [
  'xiaomi/mimo-v2-flash:free',
  'allenai/olmo-3.1-32b-think:free',
  'mistralai/devstral-2512:free',
  'nvidia/nemotron-3-nano-30b-a3b:free',
  'nex-agi/deepseek-v3.1-nex-n1:free',
  'arcee-ai/trinity-mini:free',
  'tngtech/tng-r1t-chimera:free'
];

@Component({
  selector: 'app-chat',
  imports: [FormsModule, Loading],
  templateUrl: './chat.html',
  styleUrl: './chat.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Chat implements OnInit {
  private readonly apiService = inject(ApiCallService);
  private readonly messagesContainer = viewChild<ElementRef<HTMLElement>>('messagesContainer');

  readonly models = AI_MODELS;
  readonly selectedModel = signal(AI_MODELS[0]);
  readonly sessionId = signal(localStorage.getItem('chat_session_id') || '');
  readonly messages = signal<Message[]>([]);
  readonly messageInput = signal('');
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly chatTitle = signal('New Conversation');

  readonly hasMessages = computed(() => this.messages().length > 0);

  ngOnInit(): void {
    // If we have a session, load its history
    if (this.sessionId()) {
      this.loadChatHistory();
    }
  }

  loadSession(sessionId: string): void {
    this.sessionId.set(sessionId);
    localStorage.setItem('chat_session_id', sessionId);
    this.loadChatHistory();
  }

  startNewChat(): void {
    const newSessionId = this.generateUUID();
    this.sessionId.set(newSessionId);
    localStorage.setItem('chat_session_id', newSessionId);
    this.messages.set([]);
    this.chatTitle.set('New Conversation');
    this.error.set(null);
  }

  onSendMessage(): void {
    const content = this.messageInput().trim();
    if (!content || this.isLoading()) return;

    // Ensure we have a session ID
    if (!this.sessionId()) {
      this.startNewChat();
    }

    // Add user message to UI
    const userMessage: Message = {
      id: this.generateUUID(),
      content,
      sender: 'user',
      timestamp: new Date()
    };
    this.messages.update(msgs => [...msgs, userMessage]);
    this.messageInput.set('');

    // Update title if first message
    if (this.messages().length === 1) {
      this.chatTitle.set(content.slice(0, 30) + (content.length > 30 ? '...' : ''));
    }

    // Send to API
    this.isLoading.set(true);
    this.error.set(null);

    this.apiService.post<ChatResponse>('/chat/university/', {
      message: content,
      model: this.selectedModel(),
      session_id: this.sessionId()
    }).subscribe({
      next: (response) => {
        const botMessage: Message = {
          id: this.generateUUID(),
          content: response.response || response.message || 'No response received',
          sender: 'bot',
          timestamp: new Date()
        };
        this.messages.update(msgs => [...msgs, botMessage]);
        this.isLoading.set(false);
        setTimeout(() => this.scrollToBottom(), 100);
      },
      error: (err) => {
        console.error('Chat API error:', err);
        this.error.set('Failed to send message. Please try again.');
        this.isLoading.set(false);
      }
    });

    setTimeout(() => this.scrollToBottom(), 100);
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.onSendMessage();
    }
  }

  onModelChange(model: string): void {
    this.selectedModel.set(model);
  }

  dismissError(): void {
    this.error.set(null);
  }

  private loadChatHistory(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.apiService.get<HistoryResponse>('/chat/university/history/', {
      session_id: this.sessionId()
    }).subscribe({
      next: (response) => {
        if (response.messages && Array.isArray(response.messages)) {
          const messages: Message[] = response.messages.map((msg, index) => ({
            id: `hist-${index}`,
            content: msg.content,
            sender: msg.role === 'user' ? 'user' : 'bot',
            timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date()
          }));
          this.messages.set(messages);

          // Set title from first user message
          const firstUserMsg = messages.find(m => m.sender === 'user');
          if (firstUserMsg) {
            this.chatTitle.set(firstUserMsg.content.slice(0, 30) + (firstUserMsg.content.length > 30 ? '...' : ''));
          }
        }
        this.isLoading.set(false);
        setTimeout(() => this.scrollToBottom(), 100);
      },
      error: (err) => {
        console.error('Failed to load chat history:', err);
        this.error.set('Failed to load chat history.');
        this.isLoading.set(false);
      }
    });
  }

  private scrollToBottom(): void {
    const container = this.messagesContainer()?.nativeElement;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}
