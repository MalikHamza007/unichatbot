import { Component, ChangeDetectionStrategy, inject, signal, ElementRef, viewChild, OnInit, computed, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiCallService } from '../../../core/services/api-call.service';
import { Loading } from '../loading/loading';

export interface Message {
  id: string;
  content: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  intent?: string;
  confidence?: number;
}

export interface ChatResponse {
  message?: string;
  response?: string;
  bot_response?: string;
  session_id?: string;
  detected_intent?: string;
  confidence_score?: number;
}

export interface HistoryItem {
  id: number;
  user_query: string;
  bot_response: string;
  model_used: string;
  detected_intent: string;
  confidence_score: number;
  session_id: string;
  created_at: string;
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
  imports: [FormsModule, Loading, DecimalPipe],
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

  // Notify parent when history has changed (e.g. after first response of a new chat)
  readonly historyUpdated = output<void>();

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
          content: this.formatBotResponse(response.bot_response || response.response || response.message || 'No response received'),
          sender: 'bot',
          timestamp: new Date(),
          intent: response.detected_intent,
          confidence: response.confidence_score
        };
        this.messages.update(msgs => [...msgs, botMessage]);
        this.isLoading.set(false);
        // Let parent components (App/Sidemenu) know history has changed
        this.historyUpdated.emit();
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

    this.apiService.get<HistoryItem[]>('/chat/university/history/', {
      session_id: this.sessionId()
    }).subscribe({
      next: (response) => {
        if (Array.isArray(response) && response.length > 0) {
          // Filter by current session (backend may already do this, but keep it safe)
          const sessionId = this.sessionId();
          const items = sessionId
            ? response.filter(item => item.session_id === sessionId)
            : response;

          // Sort by created_at ascending so chat appears in order
          items.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

          const messages: Message[] = [];

          items.forEach((item) => {
            const ts = new Date(item.created_at);

            // User message
            messages.push({
              id: `hist-${item.id}-user`,
              content: item.user_query,
              sender: 'user',
              timestamp: ts
            });

            // Bot reply (formatted like live responses)
            if (item.bot_response) {
              messages.push({
                id: `hist-${item.id}-bot`,
                content: this.formatBotResponse(item.bot_response),
                sender: 'bot',
                timestamp: ts,
                intent: item.detected_intent,
                confidence: item.confidence_score
              });
            }
          });

          this.messages.set(messages);

          // Set title from first user message
          const firstUserMsg = messages.find(m => m.sender === 'user');
          if (firstUserMsg) {
            this.chatTitle.set(firstUserMsg.content.slice(0, 30) + (firstUserMsg.content.length > 30 ? '...' : ''));
          }
        } else {
          this.messages.set([]);
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

  private formatBotResponse(raw: string): string {
    if (!raw) return '';

    // Convert markdown-like section headings: - **Heading**:
    let formatted = raw.replace(/- \*\*(.+?)\*\*:/g, '<h4>$1</h4>');

    // Convert remaining **bold** segments
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Preserve line breaks
    formatted = formatted.replace(/\n/g, '<br />');

    return formatted;
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}
