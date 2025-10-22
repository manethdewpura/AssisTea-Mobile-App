export type UserProfile = {
    uid: string;
    email: string;
    role: 'admin' | 'tea_plantation_manager';
    name?: string;
    displayName?: string;
    createdAt: string;
    plantationId?: string;
    plantationName?: string;
  };
