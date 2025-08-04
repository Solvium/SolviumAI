# Quick Setup Guide - Secure Login System

## 🚀 Quick Start

### 1. Generate Environment Variables

```bash
npm run setup
```

This will create a `.env.local` file with secure secrets generated automatically.

### 2. Update Required Values

Edit `.env.local` and update these values:

- `DATABASE_URL`: Your PostgreSQL connection string
- `GOOGLE_CLIENT_ID`: Your Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Your Google OAuth client secret
- `TELEGRAM_BOT_TOKEN`: Your Telegram bot token
- `TELEGRAM_BOT_USERNAME`: Your Telegram bot username

### 3. Set up Database

```bash
npm run db:generate
npm run db:push
```

### 4. Start Development Server

```bash
npm run dev
```

## 🔧 Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized origins: `http://localhost:6001`
6. Add authorized redirect URIs: `http://localhost:6001`
7. Copy Client ID and Secret to `.env.local`

## 🤖 Telegram Bot Setup

1. Create a bot with [@BotFather](https://t.me/botfather)
2. Get bot token and username
3. Configure Web App settings
4. Add bot token to `.env.local`

## 🛠️ Troubleshooting

### Google OAuth Issues

- **"The given origin is not allowed"**: Add `http://localhost:6001` to authorized origins in Google Cloud Console
- **CSP Violations**: The middleware has been updated to allow Google OAuth resources

### Database Issues

- **Connection failed**: Check your `DATABASE_URL` in `.env.local`
- **Schema errors**: Run `npm run db:push` to update database schema

### 500 Errors

- Check server logs for detailed error messages
- Ensure all environment variables are set correctly
- Verify database connection

## 🔒 Security Features

✅ **JWT Token Management**: Short-lived access tokens (15min) + long-lived refresh tokens (7 days)
✅ **Session Management**: Database-backed sessions with proper cleanup
✅ **Rate Limiting**: API protection (100 req/min) + Auth protection (5 attempts/15min)
✅ **Security Headers**: CSP, XSS protection, clickjacking prevention
✅ **Automatic Token Refresh**: Seamless user experience
✅ **Multi-device Support**: Users can have multiple active sessions

## 📁 Key Files

- `src/lib/auth/jwt.ts` - JWT token management
- `src/lib/auth/session.ts` - Session management
- `src/lib/auth/rateLimit.ts` - Rate limiting
- `src/middleware.ts` - Security headers and request handling
- `src/app/api/auth/*` - Authentication endpoints
- `src/app/contexts/AuthContext.tsx` - Client-side auth context

## 🚨 Important Notes

1. **Never commit `.env.local`** to version control
2. **Use HTTPS in production** with proper SSL certificates
3. **Rotate secrets regularly** in production environments
4. **Monitor rate limit violations** and adjust as needed
5. **Backup your database** regularly

## 📞 Support

If you encounter issues:

1. Check the server logs for detailed error messages
2. Verify all environment variables are set correctly
3. Ensure database is running and accessible
4. Check Google OAuth and Telegram bot configurations

---

**🎉 You're all set!** The secure login system is now ready to use with Telegram and Google OAuth.
