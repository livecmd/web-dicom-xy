export interface XunYingHttpConfig {
  baseUrl: string;
  hospital: string;
  token: string;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const out: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return out.join('&');
}

export function buildJsonUrl(
  config: XunYingHttpConfig,
  path: string,
  params: Record<string, string | number | undefined>
): string {
  const merged = { hospital: config.hospital, d: Date.now(), ...params };
  return `${config.baseUrl}${path}?${buildQuery(merged)}`;
}

export function buildPixelUrl(
  config: XunYingHttpConfig,
  params: Record<string, string | number | undefined>
): string {
  const merged = {
    hospital: config.hospital,
    token: config.token,
    ts: Date.now(),
    ...params,
  };
  return `${config.baseUrl}/wado?${buildQuery(merged)}`;
}

export async function fetchJson<T>(config: XunYingHttpConfig, url: string): Promise<T> {
  const response = await fetch(url, {
    method: 'GET',
    headers: { token: config.token, Accept: 'application/json' },
  });
  if (response.status === 401) {
    throw new Error('XunYing 鉴权失败：链接已失效');
  }
  if (!response.ok) {
    throw new Error(`XunYing API 请求失败 ${response.status}: ${url}`);
  }
  return (await response.json()) as T;
}

export interface XunYingPixelResponse {
  arrayBuffer: ArrayBuffer;
  width: number;
  height: number;
  frameNo: number;
  inverse: boolean;
  defaultCenter?: number;
  defaultWindow?: number;
  patientOrientation?: string;
  imageLaterality?: string;
  viewPosition?: string;
  imageType?: string;
  imageInfo: Record<string, any> | null;
  bitType: 1 | 2 | 3;
}

function parseHeaderNumber(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }
  const first = value.split('\\')[0];
  const n = parseFloat(first);
  return Number.isFinite(n) ? n : undefined;
}

function parseInfoNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const first = String(value).split('\\')[0];
  const n = parseFloat(first);
  return Number.isFinite(n) ? n : undefined;
}

export async function fetchPixelData(
  config: XunYingHttpConfig,
  studyUID: string,
  seriesUID: string,
  sopInstanceUID: string,
  frameNumber?: number,
  rows?: number,
  columns?: number
): Promise<XunYingPixelResponse> {
  const url = buildPixelUrl(config, {
    requestType: 'gsps',
    studyUID,
    seriesUID,
    objectUID: sopInstanceUID,
    frameNumber,
    rows,
    columns,
  });

  const response = await fetch(url, { method: 'GET' });
  if (response.status === 401) {
    throw new Error('XunYing 像素请求鉴权失败');
  }
  if (!response.ok) {
    throw new Error(`XunYing 像素请求失败 ${response.status}: ${sopInstanceUID}`);
  }

  const arrayBuffer = await response.arrayBuffer();

  let imageInfo: Record<string, any> | null = null;
  const imageInfoHeader = response.headers.get('imageinfo') || response.headers.get('Imageinfo');
  if (imageInfoHeader) {
    try {
      imageInfo = JSON.parse(imageInfoHeader);
    } catch {
      imageInfo = null;
    }
  }

  const width = parseInt(
    response.headers.get('width') || String(columns || imageInfo?.columns || 0),
    10
  );
  const height = parseInt(
    response.headers.get('height') || String(rows || imageInfo?.rows || 0),
    10
  );
  if (!width || !height) {
    throw new Error(`XunYing 响应缺少 width/height 头: ${sopInstanceUID}`);
  }

  const bytesPerPixel = arrayBuffer.byteLength / width / height;
  let bitType: 1 | 2 | 3;
  if (bytesPerPixel === 1) {
    bitType = 1;
  } else if (bytesPerPixel === 2) {
    bitType = 2;
  } else if (bytesPerPixel === 3) {
    bitType = 3;
  } else {
    throw new Error(
      `XunYing 像素字节数异常: byteLength=${arrayBuffer.byteLength}, ${width}x${height}`
    );
  }

  return {
    arrayBuffer,
    width,
    height,
    frameNo: parseInt(response.headers.get('Frameno') || '1', 10),
    inverse: response.headers.get('inverse') === '1',
    defaultCenter:
      parseInfoNumber(imageInfo?.wincenter) ??
      parseHeaderNumber(response.headers.get('default_center')),
    defaultWindow:
      parseInfoNumber(imageInfo?.winwidth) ??
      parseHeaderNumber(response.headers.get('default_window')),
    patientOrientation:
      response.headers.get('Patient_orientation') || imageInfo?.patient_orientation || undefined,
    imageLaterality:
      response.headers.get('Image_laterality') || imageInfo?.image_laterality || undefined,
    viewPosition: response.headers.get('View_position') || imageInfo?.view_position || undefined,
    imageType: response.headers.get('Image_type') || imageInfo?.image_type || undefined,
    imageInfo,
    bitType,
  };
}

export function buildThumbnailUrl(
  config: XunYingHttpConfig,
  studyUID: string,
  seriesUID: string,
  sopInstanceUID: string,
  rows = 128,
  columns = 128
): string {
  return buildPixelUrl(config, {
    requestType: 'wado',
    studyUID,
    seriesUID,
    objectUID: sopInstanceUID,
    rows,
    columns,
    imageQuality: 80,
  });
}
