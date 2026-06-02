import { validateDeploymentLicense } from './deploymentLicense';

function makeWindow(url: string) {
  return {
    location: new URL(url),
  } as unknown as Window;
}

describe('deploymentLicense', () => {
  const config = {
    deploymentLicense: {
      enabled: true,
      salt: 'test-salt',
      allowedHospitalHashes: [
        '6e7fe143b6c61340e3ed5bbd14b2b0b86e51c8d1db3115e5652f3768ebd6b612',
      ],
      allowedHostHashes: [
        '97e363ecd4242ad0e3e904667de3c574ef35fd6443a34c7933bdba14dcb3cc99',
      ],
    },
  };

  it('allows the configured hospital and host without storing their plain text in config', async () => {
    const result = await validateDeploymentLicense(
      config,
      makeWindow('http://target.example.local/viewer?hospital=target-hospital')
    );

    expect(result.ok).toBe(true);
  });

  it('blocks a mismatched hospital', async () => {
    const result = await validateDeploymentLicense(
      config,
      makeWindow('http://target.example.local/viewer?hospital=other')
    );

    expect(result).toEqual({ ok: false, reason: 'hospital-mismatch' });
  });

  it('blocks a mismatched host', async () => {
    const result = await validateDeploymentLicense(
      config,
      makeWindow('http://other.example.local/viewer?hospital=target-hospital')
    );

    expect(result).toEqual({ ok: false, reason: 'host-mismatch' });
  });
});
