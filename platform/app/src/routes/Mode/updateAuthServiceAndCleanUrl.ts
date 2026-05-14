/**
 * Updates the user authentication service with the provided token.
 * @param token - The token to set in the user authentication service.
 * @param userAuthenticationService - The user authentication service instance.
 */
export function updateAuthServiceFromToken(token: string, userAuthenticationService: any): void {
  if (!token) {
    return;
  }

  // if a token is passed in, set the userAuthenticationService to use it
  // for the Authorization header for all requests
  userAuthenticationService.setServiceImplementation({
    getAuthorizationHeader: () => ({
      Authorization: 'Bearer ' + token,
    }),
  });
}
