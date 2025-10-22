# Profile Page Integration Instructions

## Adding Profile Edit Modal to Profile Page

The ProfileEditModal component has been created, but needs to be integrated into the profile page at `app/profile/[userId]/page.tsx`.

### Steps to Integrate:

1. **Import the modal component** (add at top of file):
```typescript
import ProfileEditModal from '../../components/ProfileEditModal'
```

2. **Add state for modal** (add with other useState declarations around line 100):
```typescript
const [showProfileEditModal, setShowProfileEditModal] = useState(false)
```

3. **Create save handler function** (add after other handler functions around line 400):
```typescript
const handleProfileSave = async (username: string, avatar?: string) => {
  try {
    const response = await fetch('/api/profile/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, avatar })
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to update profile')
    }

    // Refresh profile data
    await fetchProfile()
  } catch (error: any) {
    throw error
  }
}
```

4. **Find the username display section**:
Look for where the username is displayed (likely has `@{profile.username}` or similar). This is typically in the profile banner/header section.

5. **Make username clickable** (replace the username display):
```typescript
{/* BEFORE: */}
<p className="text-xl text-gray-300">@{profile.username}</p>

{/* AFTER: */}
<button
  onClick={() => isOwnProfile && setShowProfileEditModal(true)}
  className={`text-xl text-gray-300 ${isOwnProfile ? 'hover:text-cyan-400 cursor-pointer transition-colors' : ''}`}
>
  @{profile.username}
  {isOwnProfile && <span className="text-xs text-cyan-500 ml-2">✏️ Edit</span>}
</button>
```

6. **Add the modal component** (add before the closing `</div>` of the main return):
```typescript
{/* Profile Edit Modal */}
{showProfileEditModal && (
  <ProfileEditModal
    isOpen={showProfileEditModal}
    onClose={() => setShowProfileEditModal(false)}
    currentUsername={profile?.username || ''}
    currentAvatar={profile?.avatar}
    onSave={handleProfileSave}
  />
)}
```

### Features:
- ✅ Modal opens when clicking username (own profile only)
- ✅ Upload profile picture (max 5MB)
- ✅ Edit username with validation
- ✅ Username uniqueness check
- ✅ Auto-refresh profile after save
- ✅ Success/error feedback

### Where to Find Elements:

The profile page has these main sections:
1. **Banner/Carousel** (lines ~620-650) - Cover art carousel
2. **Profile Info** - Usually near the banner, look for username display
3. **Stats** - Followers, plays, etc.
4. **Tracks Section** (lines ~750-900)

Search for these patterns to find the right location:
- `@{profile.username}`
- `profile.username`
- `{profile.username}`
- User display section

### Testing:
1. Visit your own profile page
2. Click on your username
3. Modal should open
4. Upload avatar and/or change username
5. Click "Save Changes"
6. Profile should refresh with new data
