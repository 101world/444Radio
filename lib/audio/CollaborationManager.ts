/**
 * Real-Time Collaboration System
 * Multi-user editing, comments, permissions, presence awareness
 */

export interface User {
  id: string
  name: string
  email?: string
  avatar?: string
  color: string
  role: 'owner' | 'editor' | 'viewer'
}

export interface Presence {
  userId: string
  cursor?: { x: number; y: number }
  selection?: string[] // IDs of selected items
  activeTrack?: string
  lastSeen: Date
  status: 'active' | 'idle' | 'away'
}

export interface Comment {
  id: string
  userId: string
  timestamp: Date
  content: string
  attachedTo: {
    type: 'track' | 'clip' | 'marker' | 'general'
    id?: string
    time?: number
  }
  resolved: boolean
  replies: CommentReply[]
}

export interface CommentReply {
  id: string
  userId: string
  timestamp: Date
  content: string
}

export interface Change {
  id: string
  userId: string
  timestamp: Date
  type: string
  data: any
  applied: boolean
}

export interface Permission {
  userId: string
  canEdit: boolean
  canComment: boolean
  canShare: boolean
  canExport: boolean
}

export interface CollaborationSession {
  sessionId: string
  projectId: string
  users: Map<string, User>
  presence: Map<string, Presence>
  comments: Map<string, Comment>
  permissions: Map<string, Permission>
  changes: Change[]
}

export class CollaborationManager {
  private session?: CollaborationSession
  private currentUser?: User
  private websocket?: WebSocket
  private presenceInterval?: number
  private listeners: Map<string, Set<Function>> = new Map()
  private changeQueue: Change[] = []
  private isConnected: boolean = false
  private reconnectAttempts: number = 0
  private maxReconnectAttempts: number = 5

  constructor() {
    this.setupPresenceTracking()
  }

  // Session Management
  async joinSession(projectId: string, user: User): Promise<void> {
    this.currentUser = user

    this.session = {
      sessionId: this.generateId(),
      projectId,
      users: new Map([[user.id, user]]),
      presence: new Map(),
      comments: new Map(),
      permissions: new Map(),
      changes: []
    }

    // Connect to WebSocket server
    await this.connect(projectId)

    // Send join event
    this.sendMessage({
      type: 'join',
      userId: user.id,
      projectId,
      user
    })

    this.emit('sessionJoined', { projectId, user })
  }

  leaveSession(): void {
    if (!this.session || !this.currentUser) return

    this.sendMessage({
      type: 'leave',
      userId: this.currentUser.id,
      projectId: this.session.projectId
    })

    this.disconnect()
    this.session = undefined
    
    this.emit('sessionLeft')
  }

  // WebSocket Connection
  private async connect(projectId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Replace with your actual WebSocket server URL
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001'
      
      try {
        this.websocket = new WebSocket(`${wsUrl}/collaborate/${projectId}`)

        this.websocket.onopen = () => {
          this.isConnected = true
          this.reconnectAttempts = 0
          this.emit('connected')
          
          // Flush queued changes
          this.flushChangeQueue()
          
          resolve()
        }

        this.websocket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data)
            this.handleMessage(message)
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error)
          }
        }

        this.websocket.onerror = (error) => {
          console.error('WebSocket error:', error)
          this.emit('connectionError', error)
          reject(error)
        }

        this.websocket.onclose = () => {
          this.isConnected = false
          this.emit('disconnected')
          
          // Attempt reconnection
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++
            setTimeout(() => this.connect(projectId), 2000 * this.reconnectAttempts)
          }
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  private disconnect(): void {
    if (this.websocket) {
      this.websocket.close()
      this.websocket = undefined
    }
    this.isConnected = false
  }

  private sendMessage(message: any): void {
    if (!this.isConnected || !this.websocket) {
      // Queue message if not connected
      if (message.type === 'change') {
        this.changeQueue.push(message.change)
      }
      return
    }

    try {
      this.websocket.send(JSON.stringify(message))
    } catch (error) {
      console.error('Failed to send message:', error)
    }
  }

  private flushChangeQueue(): void {
    if (this.changeQueue.length === 0) return

    this.changeQueue.forEach(change => {
      this.sendMessage({
        type: 'change',
        change
      })
    })

    this.changeQueue = []
  }

  private handleMessage(message: any): void {
    switch (message.type) {
      case 'user-joined':
        this.handleUserJoined(message.user)
        break

      case 'user-left':
        this.handleUserLeft(message.userId)
        break

      case 'presence-update':
        this.handlePresenceUpdate(message.userId, message.presence)
        break

      case 'change':
        this.handleRemoteChange(message.change)
        break

      case 'comment-added':
        this.handleCommentAdded(message.comment)
        break

      case 'comment-updated':
        this.handleCommentUpdated(message.comment)
        break

      case 'comment-resolved':
        this.handleCommentResolved(message.commentId)
        break

      case 'permission-updated':
        this.handlePermissionUpdated(message.userId, message.permission)
        break

      case 'sync-state':
        this.handleSyncState(message.state)
        break
    }
  }

  // User Management
  private handleUserJoined(user: User): void {
    if (!this.session) return

    this.session.users.set(user.id, user)
    this.emit('userJoined', user)
  }

  private handleUserLeft(userId: string): void {
    if (!this.session) return

    this.session.users.delete(userId)
    this.session.presence.delete(userId)
    this.emit('userLeft', userId)
  }

  getActiveUsers(): User[] {
    if (!this.session) return []
    return Array.from(this.session.users.values())
  }

  getUserPresence(userId: string): Presence | undefined {
    return this.session?.presence.get(userId)
  }

  getAllPresence(): Presence[] {
    if (!this.session) return []
    return Array.from(this.session.presence.values())
  }

  // Presence Tracking
  private setupPresenceTracking(): void {
    // Track cursor movement
    if (typeof window !== 'undefined') {
      window.addEventListener('mousemove', (e) => {
        this.updatePresence({ cursor: { x: e.clientX, y: e.clientY } })
      })

      // Track activity/idle status
      let idleTimer: number | undefined
      const resetIdleTimer = () => {
        if (idleTimer) clearTimeout(idleTimer)
        
        this.updatePresence({ status: 'active' })
        
        idleTimer = window.setTimeout(() => {
          this.updatePresence({ status: 'idle' })
        }, 60000) // 1 minute
      }

      window.addEventListener('mousemove', resetIdleTimer)
      window.addEventListener('keydown', resetIdleTimer)
    }

    // Send presence updates every 5 seconds
    this.presenceInterval = window.setInterval(() => {
      this.sendPresenceUpdate()
    }, 5000)
  }

  updatePresence(updates: Partial<Presence>): void {
    if (!this.session || !this.currentUser) return

    let presence = this.session.presence.get(this.currentUser.id)
    if (!presence) {
      presence = {
        userId: this.currentUser.id,
        lastSeen: new Date(),
        status: 'active'
      }
    }

    Object.assign(presence, updates, { lastSeen: new Date() })
    this.session.presence.set(this.currentUser.id, presence)
  }

  private sendPresenceUpdate(): void {
    if (!this.currentUser) return

    const presence = this.session?.presence.get(this.currentUser.id)
    if (presence) {
      this.sendMessage({
        type: 'presence-update',
        userId: this.currentUser.id,
        presence
      })
    }
  }

  private handlePresenceUpdate(userId: string, presence: Presence): void {
    if (!this.session) return

    this.session.presence.set(userId, presence)
    this.emit('presenceUpdated', { userId, presence })
  }

  // Change Synchronization
  broadcastChange(type: string, data: any): void {
    if (!this.currentUser) return

    const change: Change = {
      id: this.generateId(),
      userId: this.currentUser.id,
      timestamp: new Date(),
      type,
      data,
      applied: true
    }

    this.sendMessage({
      type: 'change',
      change
    })

    if (this.session) {
      this.session.changes.push(change)
    }
  }

  private handleRemoteChange(change: Change): void {
    if (!this.session) return

    // Don't apply our own changes
    if (change.userId === this.currentUser?.id) return

    this.session.changes.push(change)
    this.emit('remoteChange', change)
  }

  getChangeHistory(): Change[] {
    return this.session?.changes || []
  }

  // Comments
  addComment(content: string, attachedTo: Comment['attachedTo']): Comment {
    if (!this.currentUser) throw new Error('No current user')

    const comment: Comment = {
      id: this.generateId(),
      userId: this.currentUser.id,
      timestamp: new Date(),
      content,
      attachedTo,
      resolved: false,
      replies: []
    }

    if (this.session) {
      this.session.comments.set(comment.id, comment)
    }

    this.sendMessage({
      type: 'comment-added',
      comment
    })

    this.emit('commentAdded', comment)
    return comment
  }

  replyToComment(commentId: string, content: string): CommentReply {
    if (!this.currentUser) throw new Error('No current user')

    const comment = this.session?.comments.get(commentId)
    if (!comment) throw new Error('Comment not found')

    const reply: CommentReply = {
      id: this.generateId(),
      userId: this.currentUser.id,
      timestamp: new Date(),
      content
    }

    comment.replies.push(reply)

    this.sendMessage({
      type: 'comment-updated',
      comment
    })

    this.emit('commentUpdated', comment)
    return reply
  }

  resolveComment(commentId: string): void {
    const comment = this.session?.comments.get(commentId)
    if (!comment) return

    comment.resolved = true

    this.sendMessage({
      type: 'comment-resolved',
      commentId
    })

    this.emit('commentResolved', commentId)
  }

  private handleCommentAdded(comment: Comment): void {
    if (!this.session) return
    this.session.comments.set(comment.id, comment)
    this.emit('commentAdded', comment)
  }

  private handleCommentUpdated(comment: Comment): void {
    if (!this.session) return
    this.session.comments.set(comment.id, comment)
    this.emit('commentUpdated', comment)
  }

  private handleCommentResolved(commentId: string): void {
    const comment = this.session?.comments.get(commentId)
    if (comment) {
      comment.resolved = true
      this.emit('commentResolved', commentId)
    }
  }

  getComments(filter?: { attachedTo?: Comment['attachedTo']; resolved?: boolean }): Comment[] {
    if (!this.session) return []

    let comments = Array.from(this.session.comments.values())

    if (filter?.attachedTo) {
      comments = comments.filter(c => 
        c.attachedTo.type === filter.attachedTo!.type &&
        c.attachedTo.id === filter.attachedTo!.id
      )
    }

    if (filter?.resolved !== undefined) {
      comments = comments.filter(c => c.resolved === filter.resolved)
    }

    return comments.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  }

  // Permissions
  setPermission(userId: string, permission: Permission): void {
    if (!this.session) return
    if (!this.canManagePermissions()) return

    this.session.permissions.set(userId, permission)

    this.sendMessage({
      type: 'permission-updated',
      userId,
      permission
    })

    this.emit('permissionUpdated', { userId, permission })
  }

  getPermission(userId: string): Permission | undefined {
    return this.session?.permissions.get(userId)
  }

  canEdit(): boolean {
    if (!this.currentUser || !this.session) return false
    
    const user = this.session.users.get(this.currentUser.id)
    if (user?.role === 'owner' || user?.role === 'editor') return true

    const permission = this.session.permissions.get(this.currentUser.id)
    return permission?.canEdit ?? false
  }

  canComment(): boolean {
    if (!this.currentUser || !this.session) return false
    
    const permission = this.session.permissions.get(this.currentUser.id)
    return permission?.canComment ?? true
  }

  canManagePermissions(): boolean {
    if (!this.currentUser || !this.session) return false
    
    const user = this.session.users.get(this.currentUser.id)
    return user?.role === 'owner'
  }

  private handlePermissionUpdated(userId: string, permission: Permission): void {
    if (!this.session) return
    this.session.permissions.set(userId, permission)
    this.emit('permissionUpdated', { userId, permission })
  }

  // State Synchronization
  private handleSyncState(state: any): void {
    // Sync full state from server
    this.emit('syncState', state)
  }

  requestSync(): void {
    this.sendMessage({ type: 'request-sync' })
  }

  // Conflict Resolution
  resolveConflict(change: Change, resolution: 'accept' | 'reject'): void {
    this.sendMessage({
      type: 'resolve-conflict',
      changeId: change.id,
      resolution
    })

    this.emit('conflictResolved', { change, resolution })
  }

  // Utility Methods
  private generateId(): string {
    return `collab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // Event System
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
  }

  off(event: string, callback: Function): void {
    this.listeners.get(event)?.delete(callback)
  }

  private emit(event: string, data?: any): void {
    this.listeners.get(event)?.forEach(callback => callback(data))
  }

  // Cleanup
  dispose(): void {
    this.leaveSession()
    
    if (this.presenceInterval) {
      clearInterval(this.presenceInterval)
    }

    this.listeners.clear()
  }
}
