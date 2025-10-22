export type UserDTO = {
  uid: string;
  email: string;
  role: 'admin' | 'tea_plantation_manager';
  name?: string;
  displayName?: string;
  createdAt: any;
  lastLoginAt?: any;
  plantationId?: string;
  plantationName?: string;
};


