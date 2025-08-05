// pages/api/auth/login.ts
import type { NextApiRequest, NextApiResponse } from "next";
// import { PrismaClient } from "@prisma/client";
import { sign, verify } from "jsonwebtoken";
import * as cookie from "cookie";
import { NextRequest, NextResponse } from "next/server";

// const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
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

  if (type == "loginWithTg") {
    try {
      if (!username) {
        return NextResponse.json(
          { message: "Username and password are required" },
          { status: 400 }
        );
      }

      // Find user
      // const user = await prisma.user.findUnique({
      //   where: { username },
      // });

      // if (!user) {
      //   return NextResponse.json(
      //     { message: "Invalid credentials" },
      //     { status: 401 }
      //   );
      // }

      // Create JWT token
      const token = sign(
        {
          id: id,
          username: username,
          email: email,
        },
        process.env.JWT_SECRET!, // Make sure to set this in your .env file
        { expiresIn: "7d" }
      );

      // Set HTTP-only cookie
      const response = NextResponse.json(
        {
          message: "Login successful",
          user: { id, username, email },
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

  if (type == "loginWithGoogle") {
    try {
      if (!email) {
        NextResponse.json(
          { message: "email and password are required" },
          { status: 400 }
        );
      }

      console.log(email);
      // Find user
      // let user = await prisma.user.findUnique({
      //   where: { email },
      // });

      // if (!user) {
      //   user = await prisma.user.create({
      //     data: {
      //       referralCount: 0,
      //       email,
      //       isPremium: false,
      //       name: name,
      //       referredBy: ref,
      //       chatId: "",
      //       username,
      //       totalPoints: 0,
      //     },
      //   });
      // }

      // Assuming you have a password field in your schema (add it if missing)
      // Compare password (this example assumes you're storing hashed passwords)
      // const isValid = await compare(password, user.password);

      // if (!isValid) {
      //   return res.status(401).json({ message: 'Invalid credentials' });
      // }

      // Create JWT token
      const token = sign(
        {
          id: id,
          username: username,
          email: email,
        },
        process.env.JWT_SECRET!, // Make sure to set this in your .env file
        { expiresIn: "7d" }
      );

      const response = NextResponse.json(
        {
          message: "Login successful",
          user: { id, username, email },
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
      cookie.serialize("auth_token", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV !== "development",
        sameSite: "strict",
        expires: new Date(0),
        path: "/",
      })
    );

    return res;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");

  // Get token from cookies
  const auth_token = req.cookies.get("auth_token");

  if (!auth_token) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  if (type == "getme") {
    try {
      // Verify token
      const decoded = verify(auth_token.value, process.env.JWT_SECRET!) as {
        id: number;
      };
      console.log(decoded);
      // Get user data
      // const user = await prisma.user.findUnique({
      //   where: { id: decoded.id },
      // });

      // if (!user) {
      //   return NextResponse.json({ authenticated: false }, { status: 401 });
      // }

      return NextResponse.json(
        {
          authenticated: true,
          user: {
            id: decoded.id,
            username: "testuser",
            email: "test@example.com",
          },
        },
        { status: 200 }
      );
    } catch (error) {
      console.error("Authentication error:", error);
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }
  }
}
