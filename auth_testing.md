# Auth testing
- JWT email/password: POST /api/auth/login {email,password} sets httpOnly cookies access_token (15m) + refresh_token (7d). GET /api/auth/me. POST /api/auth/refresh. Brute force: 5 fails -> 429 for 15 min per ip:email.
- Admin seeded: admin@flowcast.app / admin123
- Google (Emergent managed): frontend redirects to https://auth.emergentagent.com/?redirect=<origin>/dashboard; callback hash #session_id=... -> POST /api/auth/google/session -> cookie session_token stored in user_sessions.
- To fake a Google session for testing: insert into users {user_id, email, name, preferences:{voice:'nova',narration_mode:'both'}} and user_sessions {user_id, session_token, expires_at: now+7d}; then send cookie session_token or header Authorization: Bearer <session_token>.
