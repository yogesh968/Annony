import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient, setAuthToken, authStorage } from '../lib/api';

const AuthContext = createContext(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = authStorage.getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    apiClient
      .get('/api/auth/me')
      .then((response) => {
        setUser(response.user);
      })
      .catch(() => {
        setAuthToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const signIn = async (email, password) => {
    setLoading(true);
    try {
      const { user: signedInUser, token } = await apiClient.post('/api/auth/login', {
        email,
        password,
      });
      setAuthToken(token);
      setUser(signedInUser);
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email, password) => {
    setLoading(true);
    try {
      const { user: newUser, token } = await apiClient.post('/api/auth/signup', {
        email,
        password,
      });
      setAuthToken(token);
      setUser(newUser);
    } catch (error) {
      console.error('Error signing up:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setAuthToken(null);
    setUser(null);
  };

  const value = {
    user,
    loading,
    signIn,
    signUp,
    signOut
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};