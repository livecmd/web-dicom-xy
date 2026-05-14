import { updateAuthServiceFromToken } from './updateAuthServiceAndCleanUrl';

describe('updateAuthServiceFromToken', () => {
  it('sets the authorization header and keeps the token in the URL', () => {
    const userAuthenticationService = {
      setServiceImplementation: jest.fn(),
    };
    const replaceStateSpy = jest.spyOn(window.history, 'replaceState');

    updateAuthServiceFromToken('abc123', userAuthenticationService);

    expect(userAuthenticationService.setServiceImplementation).toHaveBeenCalledWith({
      getAuthorizationHeader: expect.any(Function),
    });

    const [{ getAuthorizationHeader }] =
      userAuthenticationService.setServiceImplementation.mock.calls[0];
    expect(getAuthorizationHeader()).toEqual({ Authorization: 'Bearer abc123' });
    expect(replaceStateSpy).not.toHaveBeenCalled();

    replaceStateSpy.mockRestore();
  });
});
