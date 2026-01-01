import { Component, ChangeDetectionStrategy, inject, output, signal, OnInit, input } from '@angular/core';
import { ApiCallService } from '../../../core/services/api-call.service';
import { Loading } from '../loading/loading';

export interface ChatSession {
  session_id: string;
  title?: string;
  created_at?: string;
  updated_at?: string;
}

// Shape of history items returned by /chat/university/history/
interface HistoryItem {
  id: number;
  user_query: string;
  bot_response: string;
  model_used: string;
  detected_intent: string;
  confidence_score: number;
  session_id: string;
  created_at: string;
}

@Component({
  selector: 'app-sidemenu',
  imports: [Loading],
  templateUrl: './sidemenu.html',
  styleUrl: './sidemenu.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Sidemenu implements OnInit {
  private readonly apiService = inject(ApiCallService);

  readonly activeSessionId = input<string>('');
  readonly closeSidebar = output<void>();
  readonly sessionSelected = output<string>();
  readonly newChatRequested = output<void>();

  readonly chatList = signal<ChatSession[]>([]);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.loadChatSessions();
  }

  loadChatSessions(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.apiService.get<HistoryItem[]>('/chat/university/history/').subscribe({
      next: (response) => {
        if (Array.isArray(response) && response.length > 0) {
          const sessionsMap = new Map<string, ChatSession>();

          response.forEach((item) => {
            const sessionId = item.session_id;
            // Ignore items without a session id for the recent chats list
            if (!sessionId) {
              return;
            }

            const createdAt = item.created_at;
            const createdDate = new Date(createdAt);

            const existing = sessionsMap.get(sessionId);
            if (!existing) {
              // First message for this session: use its question as the title
              sessionsMap.set(sessionId, {
                session_id: sessionId,
                title: item.user_query,
                created_at: createdAt,
                updated_at: createdAt,
              });
            } else {
              // Update earliest created_at and title if this item is older
              if (existing.created_at && createdDate < new Date(existing.created_at)) {
                existing.created_at = createdAt;
                existing.title = item.user_query;
              }

              // Always track the latest activity time
              if (!existing.updated_at || createdDate > new Date(existing.updated_at)) {
                existing.updated_at = createdAt;
              }
            }
          });

          const sessions = Array.from(sessionsMap.values()).sort((a, b) => {
            const aTime = new Date(a.updated_at || a.created_at || '').getTime();
            const bTime = new Date(b.updated_at || b.created_at || '').getTime();
            return bTime - aTime; // most recent first
          });

          this.chatList.set(sessions);
        } else {
          this.chatList.set([]);
        }

        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load chat sessions:', err);
        this.error.set('Failed to load conversations');
        this.isLoading.set(false);
      }
    });
  }

  onNewChat(): void {
    this.newChatRequested.emit();
    this.closeSidebar.emit();
  }

  onSelectChat(sessionId: string): void {
    this.sessionSelected.emit(sessionId);
    this.closeSidebar.emit();
  }

  onDeleteChat(event: Event, sessionId: string): void {
    event.stopPropagation();
    const confirmed = window.confirm('Are you sure you want to delete this conversation?');
    if (!confirmed) {
      return;
    }
    this.apiService.delete<void>('/chat/university/history/', {
      session_id: sessionId
    }).subscribe({
      next: () => {
        // Remove from local list
        this.chatList.update(sessions => 
          sessions.filter(s => s.session_id !== sessionId)
        );
        
        // If deleted the active session, clear selection
        if (this.activeSessionId() === sessionId) {
          this.newChatRequested.emit();
        }
      },
      error: (err) => {
        console.error('Failed to delete session:', err);
      }
    });
  }

  isActive(sessionId: string): boolean {
    return this.activeSessionId() === sessionId;
  }

  getDisplayTitle(session: ChatSession): string {
    return session.title || `Chat ${session.session_id.slice(0, 8)}...`;
  }
}
