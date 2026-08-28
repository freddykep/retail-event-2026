function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  firebase: {
    get projectId() {
      return required("FIREBASE_PROJECT_ID");
    },
    get clientEmail() {
      return required("FIREBASE_CLIENT_EMAIL");
    },
    get privateKey() {
      return required("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n");
    },
  },
  firebaseWeb: {
    get apiKey() {
      return required("NEXT_PUBLIC_FIREBASE_API_KEY");
    },
    get authDomain() {
      return required("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");
    },
    get projectId() {
      return required("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
    },
    get appId() {
      return required("NEXT_PUBLIC_FIREBASE_APP_ID");
    },
  },
  get appHmacSecret() {
    return required("APP_HMAC_SECRET");
  },
  get sessionSecret() {
    return required("SESSION_SECRET");
  },
  /** 32-Byte-Hex-Schluessel (z.B. `openssl rand -hex 32`) fuer AES-256-GCM. */
  get accessCodeEncryptionKey() {
    return required("ACCESS_CODE_ENCRYPTION_KEY");
  },
  get appUrl() {
    return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  },
};
