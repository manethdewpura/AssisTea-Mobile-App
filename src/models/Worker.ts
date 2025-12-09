export interface Worker {
  id: string;
  name: string;
  workerId: string;
  birthDate: string;
  age: number;
  experience: string;
  gender: 'Male' | 'Female' | 'Other';
  plantationId: string;
  createdAt: number;
  updatedAt: number;
}

export interface CreateWorkerInput {
  name: string;
  workerId: string;
  birthDate: string;
  age: number;
  experience: string;
  gender: 'Male' | 'Female' | 'Other';
}
