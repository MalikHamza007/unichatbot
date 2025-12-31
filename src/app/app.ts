import { Component, signal, ChangeDetectionStrategy, viewChild } from '@angular/core';
import { Sidemenu } from './shared/components/sidemenu/sidemenu';
import { Chat } from './shared/components/chat/chat';

@Component({
  selector: 'app-root',
  imports: [Sidemenu, Chat],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App {
  protected readonly title = signal('University AI Assistant');
  protected readonly sidebarOpen = signal(false);
  protected readonly activeSessionId = signal(localStorage.getItem('chat_session_id') || '');
  
  private readonly chatComponent = viewChild<Chat>('chatComponent');

  toggleSidebar(): void {
    this.sidebarOpen.update(open => !open);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  onSessionSelected(sessionId: string): void {
    this.activeSessionId.set(sessionId);
    this.chatComponent()?.loadSession(sessionId);
  }

  onNewChatRequested(): void {
    this.chatComponent()?.startNewChat();
    const newSessionId = localStorage.getItem('chat_session_id') || '';
    this.activeSessionId.set(newSessionId);
  }
}
