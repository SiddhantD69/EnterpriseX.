import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  AuthenticationState,
} from "./auth-state";

import type {
  AuthState,
} from "./auth-types";

type AuthContextValue = {
  state: AuthState;
  authenticate: (
    email: string,
    password: string,
  ) => Promise<void>;
  chooseCompany: (
    companyId: string,
  ) => Promise<void>;
  logout: () => void;
};

const AuthContext =
  createContext<AuthContextValue | null>(
    null,
  );

type AuthProviderProps = {
  children: ReactNode;
};

export const AuthProvider = ({
  children,
}: AuthProviderProps) => {
  const [controller] =
    useState(
      () => new AuthenticationState(),
    );

  const [state, setState] =
    useState<AuthState>(
      controller.state,
    );

  const value =
    useMemo<AuthContextValue>(
      () => ({
        state,

        authenticate: async (
          email,
          password,
        ) => {
          await controller.authenticate(
            email,
            password,
          );

          setState(
            controller.state,
          );
        },

        chooseCompany: async (
          companyId,
        ) => {
          await controller.chooseCompany(
            companyId,
          );

          setState(
            controller.state,
          );
        },

        logout: () => {
          controller.logout();
          setState(
            controller.state,
          );
        },
      }),
      [controller, state],
    );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider.",
    );
  }

  return context;
};