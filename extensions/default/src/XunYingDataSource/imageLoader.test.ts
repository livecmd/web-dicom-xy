jest.mock('@cornerstonejs/core', () => ({
  imageLoader: {
    registerImageLoader: jest.fn(),
  },
}));

jest.mock('./utils/httpClient', () => ({
  fetchPixelData: jest.fn(),
}));

import { imageLoader } from '@cornerstonejs/core';
import { fetchPixelData } from './utils/httpClient';
import { registerXunYingImageLoader, setXunYingLoaderConfig } from './imageLoader';

const mockRegisterImageLoader = imageLoader.registerImageLoader as jest.Mock;
const mockFetchPixelData = fetchPixelData as jest.Mock;

describe('XunYing image loader', () => {
  it('provides the Cornerstone image frame used to create a voxel manager', async () => {
    const pixelData = new Int16Array([-100, 25, 200, 50]);
    mockFetchPixelData.mockResolvedValue({
      arrayBuffer: pixelData.buffer,
      width: 2,
      height: 2,
      bitType: 2,
      inverse: false,
      imageInfo: {},
    });
    setXunYingLoaderConfig({
      baseUrl: '/webpacs/api',
      hospital: 'ccfcyy',
      token: 'test-token',
    });
    registerXunYingImageLoader();

    const loader = mockRegisterImageLoader.mock.calls[0][1];
    const image = await loader('xunying:study/series/sop').promise;

    expect(image.dataType).toBe('Int16Array');
    expect(image.imageFrame).toMatchObject({
      imageId: 'xunying:study/series/sop',
      pixelData,
      rows: 2,
      columns: 2,
      bitsAllocated: 16,
      bitsStored: 16,
      pixelRepresentation: 1,
      smallestPixelValue: -100,
      largestPixelValue: 200,
    });
  });
});
