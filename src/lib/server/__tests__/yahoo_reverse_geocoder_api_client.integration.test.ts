import { getYahooReverseGeocodedAddress } from '../yahoo_reverse_geocoder_api_client';


const toDecimal = (degrees: number, minutes: number, seconds: number): number =>
  degrees + minutes / 60 + seconds / 3600;

const TOKYO_TOWER_LATITUDE = toDecimal(35, 39, 29.1572);
const TOKYO_TOWER_LONGITUDE = toDecimal(139, 44, 28.8869);
const describeOrSkip = process.env.YAHOO_APP_CLIENT_ID ? describe : describe.skip;

describeOrSkip('getYahooReverseGeocodedAddress (integration)', () => {
  beforeAll(() => {
    jest.setTimeout(30_000);
  });

  it('東京都港区の住所を返す', async () => {
    const address = await getYahooReverseGeocodedAddress(
      TOKYO_TOWER_LATITUDE,
      TOKYO_TOWER_LONGITUDE,
    );

    expect(address).toContain('東京都港区');
  });
});
