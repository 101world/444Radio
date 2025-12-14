/**
 * Form Validation Utilities
 * Centralized validation logic for all forms
 */

export interface ValidationResult {
  isValid: boolean
  errors: Record<string, string>
}

/**
 * Validate profile update form
 */
export function validateProfileForm(data: {
  fullName?: string
  bio?: string
  website?: string
  twitter?: string
  instagram?: string
}): ValidationResult {
  const errors: Record<string, string> = {}

  // Full name validation
  if (data.fullName && data.fullName.length > 100) {
    errors.fullName = 'Name must be less than 100 characters'
  }

  // Bio validation
  if (data.bio && data.bio.length > 500) {
    errors.bio = 'Bio must be less than 500 characters'
  }

  // Website URL validation
  if (data.website) {
    try {
      new URL(data.website)
    } catch {
      errors.website = 'Please enter a valid URL (https://example.com)'
    }
  }

  // Twitter handle validation
  if (data.twitter && !data.twitter.match(/^@?[A-Za-z0-9_]{1,15}$/)) {
    errors.twitter = 'Invalid Twitter handle (max 15 characters, alphanumeric + underscore)'
  }

  // Instagram handle validation
  if (data.instagram && !data.instagram.match(/^@?[A-Za-z0-9_.]{1,30}$/)) {
    errors.instagram = 'Invalid Instagram handle (max 30 characters)'
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  }
}

/**
 * Validate generation prompt
 */
export function validateGenerationPrompt(prompt: string): ValidationResult {
  const errors: Record<string, string> = {}

  const trimmed = prompt.trim()

  if (trimmed.length < 3) {
    errors.prompt = 'Prompt must be at least 3 characters'
  }

  if (trimmed.length > 300) {
    errors.prompt = 'Prompt must be less than 300 characters'
  }

  // Check for inappropriate content
  const inappropriate = ['explicit', 'nsfw', 'violence']
  if (inappropriate.some(word => trimmed.toLowerCase().includes(word))) {
    errors.prompt = 'Please keep prompts appropriate for all audiences'
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  }
}

/**
 * Validate chat message
 */
export function validateChatMessage(message: string): ValidationResult {
  const errors: Record<string, string> = {}

  const trimmed = message.trim()

  if (trimmed.length === 0) {
    errors.message = 'Message cannot be empty'
  }

  if (trimmed.length > 500) {
    errors.message = 'Message must be less than 500 characters'
  }

  // Basic spam detection
  if (/(.)\1{10,}/.test(trimmed)) {
    errors.message = 'Message appears to be spam'
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  }
}

/**
 * Validate email
 */
export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/**
 * Validate username
 */
export function validateUsername(username: string): ValidationResult {
  const errors: Record<string, string> = {}

  if (username.length < 3) {
    errors.username = 'Username must be at least 3 characters'
  }

  if (username.length > 20) {
    errors.username = 'Username must be less than 20 characters'
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    errors.username = 'Username can only contain letters, numbers, and underscores'
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  }
}

/**
 * Sanitize HTML to prevent XSS
 */
export function sanitizeHTML(text: string): string {
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

/**
 * Validate file upload
 */
export function validateFile(
  file: File,
  options: {
    maxSizeMB: number
    allowedTypes: string[]
  }
): ValidationResult {
  const errors: Record<string, string> = {}

  // Size check
  const sizeMB = file.size / (1024 * 1024)
  if (sizeMB > options.maxSizeMB) {
    errors.file = `File size must be less than ${options.maxSizeMB}MB (current: ${sizeMB.toFixed(1)}MB)`
  }

  // Type check
  if (!options.allowedTypes.includes(file.type)) {
    errors.file = `File type not allowed. Accepted: ${options.allowedTypes.join(', ')}`
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  }
}
