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
import { logout as revokeSession } from "../api/auth-api";

import type {
  AuthState,
} from "./auth-types";

type AuthContextValue = {
  state: AuthState;
  isCompanySelectionLoading: boolean;
  authenticate: (
    email: string,
    password: string,
  ) => Promise<void>;
  chooseCompany: (
    companyId: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
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
  const [isCompanySelectionLoading, setIsCompanySelectionLoading] =
    useState(false);

  const value =
    useMemo<AuthContextValue>(
      () => ({
        state,
        isCompanySelectionLoading,

        authenticate: async (
          email,
          password,
        ) => {
          const authentication = controller.authenticate(
            email,
            password,
          );

          setState(controller.state);
          await authentication;
          setState(
            controller.state,
          );
        },

        chooseCompany: async (
          companyId,
        ) => {
          setIsCompanySelectionLoading(true);
          try {
            await controller.chooseCompany(companyId);
            setState(controller.state);
          } finally {
            setIsCompanySelectionLoading(false);
          }
        },

        logout: async () => {
          const currentState = controller.state;
          const token = "session" in currentState
            ? currentState.session?.token
            : undefined;
          controller.logout();
          setState(
            controller.state,
          );

          if (token) {
            try {
              await revokeSession(token);
            } catch {}
          }
        },
      }),
      [controller, isCompanySelectionLoading, state],
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