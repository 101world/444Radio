import { NextRequest, NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() { return handleOptions() }

/**
 * GET /api/quests/public
 * Returns all active quests for public access (development mode) or basic quest info.
 */
export async function GET(req: NextRequest) {
  // For development mode, return sample quest data without authentication
  if (process.env.NODE_ENV !== 'production') {
    // Actual 444Radio quests from the live site
    const actualQuests = [
      // Monthly quests (100 credits each)
      {
        id: 'quest-1',
        title: 'Song Machine',
        description: 'Generate 200 songs in a month',
        quest_type: 'monthly',
        quest_level: 1,
        requirement: { action: 'generate_songs', target: 200 },
        credits_reward: 100,
        is_active: true,
        created_at: new Date().toISOString(),
        userProgress: null
      },
      {
        id: 'quest-2',
        title: 'Recruiter Elite',
        description: 'Invite 100 paying users',
        quest_type: 'monthly',
        quest_level: 1,
        requirement: { action: 'invite_users', target: 100 },
        credits_reward: 100,
        is_active: true,
        created_at: new Date().toISOString(),
        userProgress: null
      },
      {
        id: 'quest-3',
        title: 'Marketplace Maven',
        description: 'Upload 10 tracks to marketplace',
        quest_type: 'monthly',
        quest_level: 1,
        requirement: { action: 'upload_marketplace', target: 10 },
        credits_reward: 100,
        is_active: true,
        created_at: new Date().toISOString(),
        userProgress: null
      },
      {
        id: 'quest-4',
        title: 'Master Engineer',
        description: 'Use AI mastering 50 times',
        quest_type: 'monthly',
        quest_level: 1,
        requirement: { action: 'use_mastering', target: 50 },
        credits_reward: 100,
        is_active: true,
        created_at: new Date().toISOString(),
        userProgress: null
      },
      {
        id: 'quest-5',
        title: 'Streak Lord',
        description: 'Generate and release 1 track daily for 30 days',
        quest_type: 'monthly',
        quest_level: 1,
        requirement: { action: 'streak_lord', target: 30 },
        credits_reward: 100,
        is_active: true,
        created_at: new Date().toISOString(),
        userProgress: null
      },
      {
        id: 'quest-6',
        title: 'Cover Art Maestro',
        description: 'Generate 100 cover arts in a month',
        quest_type: 'monthly',
        quest_level: 1,
        requirement: { action: 'generate_cover_art', target: 100 },
        credits_reward: 100,
        is_active: true,
        created_at: new Date().toISOString(),
        userProgress: null
      },
      // Weekly quests (20 credits each)
      {
        id: 'quest-7',
        title: 'Weekly Grinder',
        description: 'Generate 25 songs this week',
        quest_type: 'weekly',
        quest_level: 1,
        requirement: { action: 'generate_songs', target: 25 },
        credits_reward: 20,
        is_active: true,
        created_at: new Date().toISOString(),
        userProgress: null
      },
      {
        id: 'quest-8',
        title: 'Social Butterfly',
        description: 'Share 10 tracks to the radio',
        quest_type: 'weekly',
        quest_level: 1,
        requirement: { action: 'share_tracks', target: 10 },
        credits_reward: 20,
        is_active: true,
        created_at: new Date().toISOString(),
        userProgress: null
      },
      {
        id: 'quest-9',
        title: 'Loyal Operator',
        description: 'Login 5 days in a week',
        quest_type: 'weekly',
        quest_level: 1,
        requirement: { action: 'login_days', target: 5 },
        credits_reward: 20,
        is_active: true,
        created_at: new Date().toISOString(),
        userProgress: null
      },
      {
        id: 'quest-10',
        title: 'Genre Explorer',
        description: 'Use 10 different genres',
        quest_type: 'weekly',
        quest_level: 1,
        requirement: { action: 'use_genres', target: 10 },
        credits_reward: 20,
        is_active: true,
        created_at: new Date().toISOString(),
        userProgress: null
      },
      {
        id: 'quest-11',
        title: 'Recruitment Drive',
        description: 'Invite 5 users',
        quest_type: 'weekly',
        quest_level: 1,
        requirement: { action: 'invite_users', target: 5 },
        credits_reward: 20,
        is_active: true,
        created_at: new Date().toISOString(),
        userProgress: null
      },
      {
        id: 'quest-12',
        title: 'Beat Maker',
        description: 'Create 10 instrumental tracks',
        quest_type: 'weekly',
        quest_level: 1,
        requirement: { action: 'create_instrumental', target: 10 },
        credits_reward: 20,
        is_active: true,
        created_at: new Date().toISOString(),
        userProgress: null
      },
      {
        id: 'quest-13',
        title: 'Weekly Grinder',
        description: 'Generate 25 songs this week (all types: standard, pro, beat maker)',
        quest_type: 'weekly',
        quest_level: 1,
        requirement: { action: 'generate_songs', target: 25 },
        credits_reward: 20,
        is_active: true,
        created_at: new Date().toISOString(),
        userProgress: null
      },
      // Daily quests (50 credits each) - currently inactive
      {
        id: 'quest-14',
        title: 'Daily Creator',
        description: 'Generate 5 songs today',
        quest_type: 'daily',
        quest_level: 1,
        requirement: { action: 'generate_songs', target: 5 },
        credits_reward: 50,
        is_active: false,
        created_at: new Date().toISOString(),
        userProgress: null
      },
      {
        id: 'quest-16',
        title: 'Model Explorer',
        description: 'Use all available AI models at least once',
        quest_type: 'daily',
        quest_level: 1,
        requirement: { action: 'use_all_models', target: 1 },
        credits_reward: 50,
        is_active: false,
        created_at: new Date().toISOString(),
        userProgress: null
      },
      // Yearly quest (250 credits)
      {
        id: 'quest-17',
        title: 'Golden Recruiter',
        description: 'Invite 1000 users in a year',
        quest_type: 'yearly',
        quest_level: 1,
        requirement: { action: 'invite_users', target: 1000 },
        credits_reward: 250,
        is_active: true,
        created_at: new Date().toISOString(),
        userProgress: null
      }
    ]

    return corsResponse(NextResponse.json({
      success: true,
      quests: actualQuests,
      message: 'Development mode - actual 444Radio quests available without authentication'
    }))
  }

  // In production, return a minimal response or redirect to login
  return corsResponse(NextResponse.json({
    success: false,
    message: 'Authentication required',
    redirect: '/sign-in'
  }, { status: 401 }))
}
