import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session extends DefaultSession {
    accessToken?:  string;
    refreshToken?: string;
    error?:        string;
    user?: {
      id?:         string;
      role?:       'customer' | 'advisor' | 'technician' | 'admin' | 'superadmin';
      first_name?: string;
      last_name?:  string;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?:  string;
    refreshToken?: string;
    role?:         string;
    first_name?:   string;
    last_name?:    string;
    error?:        string;
  }
}
