import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import axios from "axios";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function decodeJwt(token: string): { exp?: number } {
  try {
    return JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
  } catch {
    return {};
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: { email: { type: "email" }, password: { type: "password" } },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        try {
          const { data } = await axios.post(`${BASE}/api/v1/auth/login/`, {
            email: credentials.email,
            password: credentials.password,
          });
          return {
            id: data.user.id,
            email: data.user.email,
            first_name: data.user.first_name,
            last_name: data.user.last_name,
            role: data.user.role,
            puntoId: data.user.punto_id,
            puntoName: data.user.punto_name,
            accessToken: data.access,
            refreshToken: data.refresh,
          } as any;
        } catch (err: any) {
          throw new Error(
            err?.response?.data?.message ||
              err?.response?.data?.detail ||
              "Credenciales inválidas"
          );
        }
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
  callbacks: {
    async signIn({ account, user }) {
      if (account?.provider === "google" && account.id_token) {
        try {
          const { data } = await axios.post(`${BASE}/api/v1/auth/google/`, {
            id_token: account.id_token,
          });
          (user as any).id = data.user.id;
          (user as any).role = data.user.role;
          (user as any).puntoId = data.user.punto_id;
          (user as any).puntoName = data.user.punto_name;
          (user as any).accessToken = data.access;
          (user as any).refreshToken = data.refresh;
          return true;
        } catch {
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user)
        return {
          ...token,
          accessToken: (user as any).accessToken,
          refreshToken: (user as any).refreshToken,
          role: (user as any).role,
          puntoId: (user as any).puntoId,
          puntoName: (user as any).puntoName,
          first_name: (user as any).first_name,
          last_name: (user as any).last_name,
          sub: (user as any).id || token.sub,
        };
      const decoded = decodeJwt(token.accessToken as string);
      if (Date.now() < (decoded.exp ?? 0) * 1000 - 60_000) return token;
      try {
        const { data } = await axios.post(`${BASE}/api/v1/auth/token/refresh/`, {
          refresh: token.refreshToken,
        });
        return {
          ...token,
          accessToken: data.access,
          refreshToken: data.refresh ?? token.refreshToken,
        };
      } catch {
        return { ...token, error: "RefreshAccessTokenError" };
      }
    },
    async session({ session, token }) {
      (session as any).accessToken = token.accessToken;
      (session as any).refreshToken = token.refreshToken;
      (session as any).error = token.error;
      if (session.user) {
        (session.user as any).id = token.sub;
        (session.user as any).role = token.role;
        (session.user as any).puntoId = token.puntoId;
        (session.user as any).puntoName = token.puntoName;
        (session.user as any).first_name = token.first_name;
        (session.user as any).last_name = token.last_name;
      }
      return session;
    },
  },
  pages: { signIn: "/auth/login" },
  secret: process.env.NEXTAUTH_SECRET,
};
