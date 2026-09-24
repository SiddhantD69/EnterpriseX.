import {
  getCompanies,
  login,
  selectCompanyContext,
} from "../api/auth-api";

import {
  getPlatformContext,
} from "../api/context-api";

import type {
  AuthenticatedUser,
  AuthState,
  SessionState,
} from "./auth-types";

const loggedOutState = (): AuthState => ({
  status: "LOGGED_OUT",
  user: null,
  session: null,
  companyContext: null,
  context: null,
  companies: [],
});

export type AuthController = {
  state: AuthState;

  authenticate(
    email: string,
    password: string,
  ): Promise<void>;

  chooseCompany(
    companyId: string,
  ): Promise<void>;

  logout(): void;
};

export class AuthenticationState
  implements AuthController
{
  state: AuthState = loggedOutState();

  private setState(
    state: AuthState,
  ): void {
    this.state = state;
  }

  async authenticate(
    email: string,
    password: string,
  ): Promise<void> {
    this.setState({
      status: "AUTHENTICATING",
      user: null,
      session: null,
      companyContext: null,
      context: null,
      companies: [],
    });

    try {
      const response = await login(
        email,
        password,
      );

      const session: SessionState = {
        token: response.session.token,
        expiresAt:
          response.session.expiresAt,
      };

      if (
        response.companyContext.status ===
        "NO_COMPANY_ACCESS"
      ) {
        this.setState({
          status: "ERROR",
          message:
            "Your account does not have access to an active company.",
          user: response.user,
          session,
          companyContext:
            response.companyContext,
          context: null,
          companies: [],
        });

        return;
      }

      if (
        response.companyContext.status ===
        "SELECTION_REQUIRED"
      ) {
        const companies =
          await getCompanies(
            session.token,
          );

        if (
          companies.companies.length === 0
        ) {
          this.setState({
            status: "ERROR",
            message:
              "No active companies are available for your account.",
            user: response.user,
            session,
            companyContext:
              response.companyContext,
            context: null,
            companies: [],
          });

          return;
        }

        this.setState({
          status:
            "COMPANY_SELECTION_REQUIRED",
          user: response.user,
          session,
          companyContext:
            response.companyContext,
          context: null,
          companies:
            companies.companies,
        });

        return;
      }

      await this.loadContext(
        response.user,
        session,
        {
          status: "SELECTED",
          organizationId:
            response.companyContext
              .organizationId as string,
          companyId:
            response.companyContext
              .companyId as string,
        },
      );
    } catch (error) {
      this.setState({
        status: "ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Authentication failed.",
        user: null,
        session: null,
        companyContext: null,
        context: null,
        companies: [],
      });
    }
  }

  async chooseCompany(
    companyId: string,
  ): Promise<void> {
    if (
      this.state.status !==
      "COMPANY_SELECTION_REQUIRED"
    ) {
      return;
    }

    const {
      user,
      session,
    } = this.state;

    try {
      const response =
        await selectCompanyContext(
          session.token,
          companyId,
        );

      await this.loadContext(
        user,
        session,
        response.companyContext,
      );
    } catch (error) {
      this.setState({
        status: "ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Unable to select company.",
        user,
        session,
        companyContext:
          this.state.companyContext,
        context: null,
        companies:
          this.state.companies,
      });
    }
  }

  logout(): void {
    this.setState(
      loggedOutState(),
    );
  }

  private async loadContext(
    user: AuthenticatedUser,
    session: SessionState,
    companyContext: {
      status: "SELECTED";
      organizationId: string;
      companyId: string;
    },
  ): Promise<void> {
    this.setState({
      status: "LOADING_CONTEXT",
      user,
      session,
      companyContext,
      context: null,
      companies: [],
    });

    try {
      const context =
        await getPlatformContext(
          session.token,
        );

      this.setState({
        status: "AUTHENTICATED",
        user,
        session,
        companyContext,
        context,
        companies: [],
      });
    } catch (error) {
      this.setState({
        status: "ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Unable to load EnterpriseX context.",
        user,
        session,
        companyContext,
        context: null,
        companies: [],
      });
    }
  }
}