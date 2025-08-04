# Secure Login System Setup Guide

## Overview

This document outlines the implementation of a secure, persistent login system for the Solvium application. The system includes JWT-based authentication, session management, rate limiting, and comprehensive security measures.

## Security Features Implemented

### 1. JWT Token Management
- **Access Tokens**: Short-lived (15 minutes) for API access
- **Refresh Tokens**: Long-lived (7 days) for session persistence
- **Secure Signing**: HMAC-SHA256 with strong secrets
- **Token Validation**: Issuer, audience, and expiry verification

### 2. Session Management
- **Database-backed Sessions**: All sessions stored in PostgreSQL
- **Session Invalidation**: Proper cleanup on logout
- **Multi-device Support**: Users can have multiple active sessions
- **Session Tracking**: IP address and user agent logging

### 3. Rate Limiting
- **API Protection**: 100 requests per minute for general API
- **Auth Protection**: 5 login attempts per 15 minutes
- **IP-based Tracking**: Prevents brute force attacks
- **Automatic Cleanup**: Old rate limit records removed

### 4. Security Headers
- **Content Security Policy**: Restricts resource loading
- **X-Frame-Options**: Prevents clickjacking
- **X-Content-Type-Options**: Prevents MIME sniffing
- **X-XSS-Protection**: Additional XSS protection
- **Referrer Policy**: Controls referrer information

### 5. Authentication Providers
- **Telegram OAuth**: Secure Telegram Web App integration
- **Google OAuth**: Google Sign-In with JWT verification
- **Extensible Architecture**: Easy to add new providers

## Database Schema Updates

### New Models Added

#### Session Model
```sql
model Session {
  id           String   @id @default(uuid())
  userId       Int
  refreshToken String
  expiresAt    DateTime
  userAgent    String?
  ipAddress    String?
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([refreshToken])
}
```

#### RateLimit Model
```sql
model RateLimit {
  id        Int      @id @default(autoincrement())
  key       String   // Rate limit key (e.g., "ip:path")
  ipAddress String
  userAgent String?
  createdAt DateTime @default(now())

  @@index([key, createdAt])
  @@index([ipAddress])
}
```

#### LoginMethod Model (Enhanced)
```sql
model LoginMethod {
  id     Int    @id @default(autoincrement())
  type   String // e.g., "email", "wallet", "telegram"
  value  String
  userId Int
  user   User   @relation(fields: [userId], references: [id])

  @@unique([type, value])
}
```

## Environment Variables Required

Create a `.env.local` file with the following variables:

```bash
# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/solvium_db"

# JWT Configuration
JWT_ACCESS_SECRET="your-super-secure-access-secret-key-here-min-32-chars"
JWT_REFRESH_SECRET="your-super-secure-refresh-secret-key-here-min-32-chars"

# Google OAuth Configuration
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN="your-telegram-bot-token"
TELEGRAM_BOT_USERNAME="your-telegram-bot-username"

# Security Configuration
NEXTAUTH_SECRET="your-nextauth-secret-key-here"
NEXTAUTH_URL="http://localhost:6001"

# Rate Limiting Configuration
RATE_LIMIT_ENABLED="true"
RATE_LIMIT_WINDOW_MS="900000" # 15 minutes
RATE_LIMIT_MAX_REQUESTS="100"

# Session Configuration
SESSION_SECRET="your-session-secret-key-here"
SESSION_MAX_AGE="604800" # 7 days in seconds

# CORS Configuration
CORS_ORIGIN="http://localhost:6001"
CORS_CREDENTIALS="true"

# Logging Configuration
LOG_LEVEL="info"
LOG_FORMAT="json"

# Production Configuration
NODE_ENV="development"
NEXT_PUBLIC_APP_URL="http://localhost:6001"
```

## Setup Instructions

### 1. Database Migration
```bash
# Generate and run database migrations
npx prisma generate
npx prisma db push
```

### 2. Install Dependencies
```bash
# Install required packages
npm install jsonwebtoken @types/jsonwebtoken
```

### 3. Generate Secure Secrets
```bash
# Generate JWT secrets (run in terminal)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Configure OAuth Providers

#### Google OAuth Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized origins and redirect URIs
6. Copy Client ID and Secret to environment variables

#### Telegram Bot Setup
1. Create a bot with [@BotFather](https://t.me/botfather)
2. Get bot token and username
3. Configure Web App settings
4. Add bot token to environment variables

## API Endpoints

### Authentication Endpoints
- `POST /api/auth/telegram` - Telegram login
- `POST /api/auth/google` - Google login
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout and invalidate session
- `GET /api/auth/me` - Get current user info

### Security Features
- **Rate Limiting**: All endpoints protected
- **Session Validation**: Automatic token verification
- **CSRF Protection**: SameSite cookie policy
- **XSS Protection**: Content Security Policy headers

## Client-Side Integration

### AuthContext Usage
```typescript
import { useAuth } from '@/app/contexts/AuthContext';

function MyComponent() {
  const { user, isAuthenticated, loginWithTelegram, loginWithGoogle, logout } = useAuth();
  
  // Automatic token refresh handled by context
  // Session persistence across page reloads
}
```

### Automatic Token Refresh
- Tokens automatically refreshed every 14 minutes
- Seamless user experience with persistent sessions
- Automatic logout on token refresh failure

## Security Best Practices

### 1. Secret Management
- Use strong, unique secrets for JWT signing
- Rotate secrets regularly in production
- Never commit secrets to version control

### 2. Rate Limiting
- Monitor rate limit violations
- Adjust limits based on usage patterns
- Implement progressive delays for repeated violations

### 3. Session Management
- Regularly clean up expired sessions
- Monitor for suspicious session activity
- Implement session timeout warnings

### 4. Error Handling
- Never expose sensitive information in error messages
- Log security events for monitoring
- Implement proper error responses

## Monitoring and Logging

### Security Events to Monitor
- Failed login attempts
- Rate limit violations
- Session creation/deletion
- Token refresh failures
- Suspicious IP addresses

### Recommended Monitoring Tools
- Application logs with structured logging
- Database query monitoring
- Rate limit violation alerts
- Session analytics

## Production Deployment

### 1. Environment Configuration
- Set `NODE_ENV=production`
- Use HTTPS in production
- Configure proper CORS origins
- Set secure cookie flags

### 2. Database Security
- Use connection pooling
- Implement database backup strategy
- Monitor database performance
- Regular security updates

### 3. Infrastructure Security
- Use HTTPS/TLS encryption
- Implement proper firewall rules
- Regular security audits
- Monitor for vulnerabilities

## Troubleshooting

### Common Issues

#### Token Refresh Failures
- Check JWT secrets configuration
- Verify database connectivity
- Monitor session table for issues

#### Rate Limiting Issues
- Check rate limit configuration
- Monitor rate limit table size
- Verify IP address detection

#### Session Persistence Issues
- Check cookie configuration
- Verify database session storage
- Monitor session cleanup jobs

### Debug Mode
Enable debug logging by setting:
```bash
LOG_LEVEL="debug"
```

## Future Enhancements

### Planned Features
1. **Multi-factor Authentication**: SMS/Email verification
2. **Device Management**: View and manage active sessions
3. **Audit Logging**: Comprehensive security event logging
4. **Advanced Rate Limiting**: Adaptive rate limiting based on user behavior
5. **Session Analytics**: User session behavior analysis

### Security Improvements
1. **Biometric Authentication**: Fingerprint/Face ID support
2. **Hardware Security**: TPM/Hardware key integration
3. **Zero-knowledge Architecture**: End-to-end encryption
4. **Threat Detection**: AI-powered security monitoring

## Support

For security-related issues or questions:
1. Check the application logs
2. Review this documentation
3. Test with debug mode enabled
4. Contact the development team

---

**Important**: This security system is designed for production use but should be thoroughly tested in a staging environment before deployment. 