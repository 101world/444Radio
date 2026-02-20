# RUN THIS ROLLBACK NOW

## ⚠️ IMPORTANT: Copy the SQL FILE, not this text!

### Steps:

1. **Open the SQL file**: `ROLLBACK-DUPLICATE-CREDITS-FIXED.sql`

2. **Select ALL the SQL code** (from line 1 to line 115)
   - Start: `-- ROLLBACK DUPLICATE FREE CREDITS`
   - End: `ORDER BY total DESC;`

3. **Copy it** (Ctrl+A, then Ctrl+C when the file is open)

4. **Go to Supabase** → SQL Editor

5. **Paste** the entire SQL code

6. **Click "Run"**

---

## What You'll See:

The output panel will show messages like:
```
NOTICE:  === Starting Credit Rollback ===
NOTICE:  Processing user user_XXX: received 72, removing 48 excess credits
NOTICE:  Corrected user user_XXX: removed 48 excess credits, deleted 2 duplicate transactions
...
NOTICE:  === Rollback Complete ===
```

Then a table showing:
```
clerk_user_id | paid | free | total
--------------+------+------+------
user_XXX      |  20  |  24  |  44
user_YYY      |  20  |  24  |  44
```

---

## If You Get An Error:

**DON'T** copy from this markdown file!  
**DO** copy from `ROLLBACK-DUPLICATE-CREDITS-FIXED.sql`

---

## After Success:

Run this verification in a new query:
```sql
SELECT 
    COUNT(*) as users_with_free_credits,
    AVG(free_credits) as avg_free_credits
FROM users
WHERE free_credits > 0;
```

Should show: `avg_free_credits = 24`
