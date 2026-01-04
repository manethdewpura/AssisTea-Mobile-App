import { configService } from '../services/config.service';
import { ensureNetworkConnection, NetworkError } from './network.util';
import { AppError } from './errorHandling.util';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  [key: string]: any;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: any;
  headers?: Record<string, string>;
  timeout?: number;
}

const DEFAULT_TIMEOUT = 10000; // 10 seconds

/**
 * Base API client that handles requests to the backend
 */
class ApiClient {
  private async getBaseUrl(): Promise<string> {
    const url = await configService.getBackendUrl();
    if (!url) {
      throw new AppError(
        'Backend URL not configured',
        'BACKEND_URL_NOT_CONFIGURED',
        'high',
        true,
        'Please configure the backend URL in settings'
      );
    }
    return url;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    // Ensure network connection
    await ensureNetworkConnection();

    const {
      method = 'GET',
      body,
      headers = {},
      timeout = DEFAULT_TIMEOUT,
    } = options;

    const baseUrl = await this.getBaseUrl();
    const url = `${baseUrl}/api${endpoint}`;

    // Set default headers
    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const fetchOptions: RequestInit = {
        method,
        headers: defaultHeaders,
        signal: controller.signal,
      };

      if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        fetchOptions.body = JSON.stringify(body);
      }

      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      // Handle non-JSON responses
      const contentType = response.headers.get('content-type');
      let data: any;
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        try {
          data = JSON.parse(text);
        } catch {
          data = { message: text };
        }
      }

      // Check if response indicates success
      if (!response.ok) {
        // Extract error message, prioritizing message field for user-friendly errors
        const errorMessage = data.message || data.error || `HTTP ${response.status}: ${response.statusText}`;
        const userMessage = data.message || data.error || `Request failed: ${response.statusText}`;
        
        throw new AppError(
          errorMessage,
          `HTTP_${response.status}`,
          response.status >= 500 ? 'high' : 'medium',
          response.status < 500,
          userMessage
        );
      }
      
      // Also check if the response data indicates failure (even with 200 status)
      if (data.success === false) {
        const errorMessage = data.message || data.error || 'Request failed';
        throw new AppError(
          errorMessage,
          'API_ERROR',
          'medium',
          true,
          errorMessage
        );
      }

      // Return standardized response
      return {
        success: data.success !== false, // Default to true if not specified
        ...data,
        data: data.data || data,
      };
    } catch (error: any) {
      clearTimeout(timeoutId);

      // Handle abort (timeout)
      if (error.name === 'AbortError') {
        throw new AppError(
          'Request timeout',
          'REQUEST_TIMEOUT',
          'medium',
          true,
          'The request took too long. Please check your connection and try again.'
        );
      }

      // Handle network errors
      if (error instanceof NetworkError) {
        throw error;
      }

      // Handle AppError
      if (error instanceof AppError) {
        throw error;
      }

      // Handle fetch errors (network issues, etc.)
      if (error.message?.includes('Network request failed') || 
          error.message?.includes('Failed to fetch')) {
        throw new NetworkError('Unable to connect to the backend server. Please check the URL and your network connection.');
      }

      // Generic error
      throw new AppError(
        error.message || 'An unexpected error occurred',
        'API_ERROR',
        'medium',
        true,
        'Failed to communicate with the server. Please try again.'
      );
    }
  }

  async get<T>(endpoint: string, options?: Omit<RequestOptions, 'method'>): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(endpoint: string, body?: any, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { ...options, method: 'POST', body });
  }

  async put<T>(endpoint: string, body?: any, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { ...options, method: 'PUT', body });
  }

  async delete<T>(endpoint: string, options?: Omit<RequestOptions, 'method'>): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { ...options, method: 'DELETE' });
  }

  async patch<T>(endpoint: string, body?: any, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { ...options, method: 'PATCH', body });
  }
}

export const apiClient = new ApiClient();

