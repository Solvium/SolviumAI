// pages/api/auth/login.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { sign, verify } from "jsonwebtoken";
import * as cookie from "cookie";
import { NextRequest, NextResponse } from "next/server";

const FILE_NAME = "user/route.ts";

export async function POST(req: NextRequest) {
  console.log(`[${FILE_NAME}:POST] POST request received`);

  try {
    const {
      username,
      id,
      type,
      wallet,
      data,
      ref,
      email,
      name,
      message,
      userMultipler,
    } = await req.json();

    console.log(`[${FILE_NAME}:POST] Request data:`, {
      type,
      username,
      id,
      hasWallet: !!wallet,
      hasData: !!data,
    });

    if (type == "loginWithTg") {
      console.log(
        `[${FILE_NAME}:POST] Processing Telegram login for username:`,
        username
      );

      try {
        if (!username) {
          console.error(`[${FILE_NAME}:POST] Username is required`);
          return NextResponse.json(
            { message: "Username is required" },
            { status: 400 }
          );
        }

        // Find or create user
        console.log(`[${FILE_NAME}:POST] Looking up user in database...`);
        let user = await prisma.user.findUnique({
          where: { username },
        });

        if (!user) {
          console.log(
            `[${FILE_NAME}:POST] User not found, creating new user...`
          );
          // Create new user if doesn't exist
          user = await prisma.user.create({
            data: {
              username,
              referredBy: "",
              chatId: "",
              totalPoints: 0,
              referralCount: 0,
              isMining: false,
              isPremium: false,
              lastClaim: new Date(),
              lastSpinClaim: new Date(),
            },
          });
          console.log(`[${FILE_NAME}:POST] New user created with ID:`, user.id);
        } else {
          console.log(
            `[${FILE_NAME}:POST] Existing user found with ID:`,
            user.id
          );
        }

        // Create JWT token
        console.log(`[${FILE_NAME}:POST] Creating JWT token...`);
        const token = sign(
          {
            id: user.id,
            username: user.username,
            email: user.email,
          },
          process.env.JWT_SECRET!, // Make sure to set this in your .env file
          { expiresIn: "7d" }
        );

        console.log(`[${FILE_NAME}:POST] JWT token created successfully`);

        // Set HTTP-only cookie
        const response = NextResponse.json(
          {
            message: "Login successful",
            user: {
              id: user.id,
              username: user.username,
              email: user.email,
              name: user.name,
              totalPoints: user.totalPoints,
              referralCount: user.referralCount,
              chatId: user.chatId,
              isMining: user.isMining,
              lastClaim: user.lastClaim,
              wallet: user.wallet,
            },
          },
          { status: 200 }
        );

        // Manually serialize the cookie
        const serialized = cookie.serialize("auth_token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV !== "development",
          sameSite: "strict",
          maxAge: 60 * 60 * 24 * 7, // 1 week
          path: "/",
        });

        response.headers.set("Set-Cookie", serialized);
        console.log(
          `[${FILE_NAME}:POST] Login successful, cookie set for user:`,
          user.username
        );
        return response;
      } catch (error) {
        console.error(`[${FILE_NAME}:POST] Login error:`, error);
        return NextResponse.json(
          { message: "Internal server error" },
          { status: 500 }
        );
      }
    }

    if (type == "loginWithGoogle") {
      try {
        if (!email) {
          return NextResponse.json(
            { message: "Email is required" },
            { status: 400 }
          );
        }

        console.log(email);
        // Find or create user
        let user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user) {
          user = await prisma.user.create({
            data: {
              referralCount: 0,
              email,
              isPremium: false,
              name: name,
              referredBy: ref || "",
              chatId: "",
              username,
              totalPoints: 0,
              lastClaim: new Date(),
              lastSpinClaim: new Date(),
            },
          });
        }

        // Create JWT token
        const token = sign(
          {
            id: user.id,
            username: user.username,
            email: user.email,
          },
          process.env.JWT_SECRET!, // Make sure to set this in your .env file
          { expiresIn: "7d" }
        );

        const response = NextResponse.json(
          {
            message: "Login successful",
            user: {
              id: user.id,
              username: user.username,
              email: user.email,
              name: user.name,
              totalPoints: user.totalPoints,
              referralCount: user.referralCount,
              chatId: user.chatId,
              isMining: user.isMining,
              lastClaim: user.lastClaim,
              wallet: user.wallet,
            },
          },
          { status: 200 }
        );

        // Manually serialize the cookie
        const serialized = cookie.serialize("auth_token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV !== "development",
          sameSite: "strict",
          maxAge: 60 * 60 * 24 * 7, // 1 week
          path: "/",
        });

        response.headers.set("Set-Cookie", serialized);
        return response;
      } catch (error) {
        console.error("Login error:", error);
        return NextResponse.json(
          { message: "Internal server error" },
          { status: 500 }
        );
      }
    }

    //   if(type == "register"){

    //       try {

    //         if (!username ) {
    //           return res.status(400).json({ message: 'Username and password are required' });
    //         }

    //         // Check if user already exists
    //         const existingUser = await prisma.user.findFirst({
    //           where: {
    //             OR: [
    //               { username },
    //               { email: email || undefined },
    //             ],
    //           },
    //         });

    //         if (existingUser) {
    //           return res.status(409).json({ message: 'Username or email already exists' });
    //         }

    //         // // Hash password
    //         // const hashedPassword = await hash(password, 10);

    //         // Create user
    //         const user = await prisma.user.create({
    //           data: {
    //             username,
    //             email,
    //             name,
    //             referredBy,
    //             // password: hashedPassword, // Add password field to your schema
    //           },
    //         });

    //         // If referral code was provided, increment referral count for referring user
    //         if (referredBy) {
    //           await prisma.user.update({
    //             where: { username: referredBy },
    //             data: { referralCount: { increment: 1 } },
    //           });
    //         }

    //         // Create token
    //         const token = sign(
    //           {
    //             id: user.id,
    //             username: user.username,
    //             email: user.email,
    //           },
    //           process.env.JWT_SECRET!,
    //           { expiresIn: '7d' }
    //         );

    //         // Set cookie
    //         res.setHeader(
    //           'Set-Cookie',
    //           cookie.serialize('auth_token', token, {
    //             httpOnly: true,
    //             secure: process.env.NODE_ENV !== 'development',
    //             sameSite: 'strict',
    //             maxAge: 60 * 60 * 24 * 7, // 1 week
    //             path: '/',
    //           })
    //         );

    //         return res.status(201).json({
    //           message: 'User created successfully',
    //           user: {
    //             id: user.id,
    //             username: user.username,
    //             email: user.email,
    //             name: user.name,
    //           },
    //         });
    //       } catch (error) {
    //         console.error('Registration error:', error);
    //         return res.status(500).json({ message: 'Internal server error' });
    //       }
    //   }

    if (type == "logout") {
      // Clear the auth cookie

      const res = NextResponse.json({ message: "Logged out successfully" });
      res.headers.set(
        "Set-Cookie",
        cookie.serialize("access_token", "", {
          httpOnly: true,
          secure: process.env.NODE_ENV !== "development",
          sameSite: "strict",
          expires: new Date(0),
          path: "/",
        })
      );

      return res;
    }
  } catch (error) {
    console.error(`[${FILE_NAME}:POST] POST request error:`, error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  console.log(`[${FILE_NAME}:GET] GET request received`);

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");

  console.log(`[${FILE_NAME}:GET] Request parameters:`, {
    type,
    searchParams: Object.fromEntries(searchParams.entries()),
  });

  // Get token from cookies - fix cookie name to match what's set in POST
  const auth_token = req.cookies.get("auth_token");

  console.log(`[${FILE_NAME}:GET] Cookie check:`, {
    hasAuthToken: !!auth_token,
    authTokenValue: auth_token?.value ? "present" : "missing",
  });

  if (!auth_token) {
    console.log(`[${FILE_NAME}:GET] No auth token found, returning 401`);
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  if (type == "getme") {
    console.log(`[${FILE_NAME}:GET] Processing getme request...`);

    try {
      // Verify token
      console.log(`[${FILE_NAME}:GET] Verifying JWT token...`);
      const decoded = verify(auth_token.value, process.env.JWT_SECRET!) as {
        id: number;
      };
      console.log(
        `[${FILE_NAME}:GET] JWT token verified, user ID:`,
        decoded.id
      );

      // Get user data
      console.log(`[${FILE_NAME}:GET] Fetching user data from database...`);
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
      });

      if (!user) {
        console.log(
          `[${FILE_NAME}:GET] User not found in database for ID:`,
          decoded.id
        );
        return NextResponse.json({ authenticated: false }, { status: 401 });
      }

      console.log(`[${FILE_NAME}:GET] User data retrieved:`, {
        id: user.id,
        username: user.username,
        hasChatId: !!user.chatId,
        chatId: user.chatId,
      });

      const response = {
        authenticated: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.name,
          totalPoints: user.totalPoints,
          referralCount: user.referralCount,
          chatId: user.chatId,
          isMining: user.isMining,
          lastClaim: user.lastClaim,
          wallet: user.wallet,
        },
      };

      console.log(
        `[${FILE_NAME}:GET] Sending authenticated response for user:`,
        user.username
      );
      return NextResponse.json(response, { status: 200 });
    } catch (error) {
      console.error(`[${FILE_NAME}:GET] Authentication error:`, error);
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }
  }

  console.log(`[${FILE_NAME}:GET] Unknown request type:`, type);
  return NextResponse.json({ error: "Unknown request type" }, { status: 400 });
}
