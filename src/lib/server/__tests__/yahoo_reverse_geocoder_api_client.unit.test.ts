import { getYahooReverseGeocodedAddress } from '../yahoo_reverse_geocoder_api_client';

describe('getYahooReverseGeocodedAddress (unit)', () => {
  const originalFetch = global.fetch;
  const originalAppId = process.env.YAHOO_APP_ID;
  const latitude = 35.0;
  const longitude = 139.0;

  beforeEach(() => {
    jest.useRealTimers();
    process.env.YAHOO_APP_ID = 'test-app-id';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  afterAll(() => {
    global.fetch = originalFetch;
    process.env.YAHOO_APP_ID = originalAppId;
  });

  it('APIが200を返した場合に住所を返す', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <YDF>
      <Feature>
        <Property>
          <Address>東京都港区</Address>
        </Property>
      </Feature>
    </YDF>`;

    const response = new Response(xml, {
      status: 200,
      headers: { 'Content-Type': 'application/xml' },
    });
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(response);
    const address = await getYahooReverseGeocodedAddress(latitude, longitude);

    expect(address).toBe('東京都港区');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('APIが非200を返し続ける場合は再試行し最終的に例外を投げる', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('<ResultSet></ResultSet>', { status: 500 }));

    await expect(getYahooReverseGeocodedAddress(latitude, longitude)).rejects.toThrow(
      'Unexpected status code: 500',
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('リクエストがタイムアウトすると中断して再試行する', async () => {
    jest.useFakeTimers();

    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockImplementation(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const signal = init?.signal as AbortSignal | undefined;

        // fetchは必ずタイムアウトする
        return new Promise<Response>((_resolve, reject) => {
          signal?.addEventListener('abort', () => {
            reject(new Error('Request timeout'));
          });
        });
      });

    const promise = getYahooReverseGeocodedAddress(latitude, longitude);
    const rejection = expect(promise).rejects.toThrow('Request timeout');
    // timeoutのabortが発生するようにする
    for (let i = 0; i < 3; i += 1) {
      await jest.advanceTimersByTimeAsync(5000);
    }
    // 実行して、アサーション
    await rejection;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
