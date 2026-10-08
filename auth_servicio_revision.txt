import {
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';

import { auth } from './firebase';

export const loginWithEmailAndPassword = async (
  email,
  password
) => {
  const correoLimpio = email.trim().toLowerCase();

  const result = await signInWithEmailAndPassword(
    auth,
    correoLimpio,
    password
  );

  return result.user;
};

export const logout = async () => {
  await signOut(auth);
};