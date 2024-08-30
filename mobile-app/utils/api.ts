const API_URL = 'https://neuron-api.ienioladewumi.workers.dev';

type UserType = 'lecturer' | 'student' | null;

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
}

interface AuthInitiateResponse {
  id: string;
}

interface UserDetailsResponse {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  matricNumber?: string;
  userType: UserType;
}

async function handleApiResponse<T>(
  response: Response,
): Promise<ApiResponse<T>> {
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'An error occurred');
  }
  return await response.json();
}

export async function initiateAuth(
  email: string,
): Promise<ApiResponse<AuthInitiateResponse>> {
  const response = await fetch(`${API_URL}/api/auth/initiate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({email}),
  });
  return handleApiResponse<AuthInitiateResponse>(response);
}

export async function completeAuth(
  userId: string,
  otp: string,
): Promise<ApiResponse<null>> {
  const response = await fetch(`${API_URL}/api/auth/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({id: userId, otp}),
  });
  return handleApiResponse<null>(response);
}

export async function fetchUserDetails(
  userId: string,
): Promise<ApiResponse<UserDetailsResponse>> {
  const response = await fetch(`${API_URL}/api/users/${userId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return handleApiResponse<UserDetailsResponse>(response);
}
