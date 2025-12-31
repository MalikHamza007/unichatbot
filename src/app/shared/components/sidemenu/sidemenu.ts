import { Component, ChangeDetectionStrategy, inject, output, signal, OnInit, input } from '@angular/core';
import { ApiCallService } from '../../../core/services/api-call.service';
import { Loading } from '../loading/loading';

export interface ChatSession {
  session_id: string;
  title?: string;
  created_at?: string;
  updated_at?: string;
}

export interface HistoryListResponse {
  sessions?: ChatSession[];
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

    this.apiService.get<HistoryListResponse>('/chat/university/history/').subscribe({
      next: (response) => {
        if (response.sessions && Array.isArray(response.sessions)) {
          this.chatList.set(response.sessions);
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
