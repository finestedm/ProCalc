
export const fetchEurRate = async (): Promise<number | null> => {
  try {
    // Fetching from Table C (Bid/Ask rates). 'ask' is the selling rate.
    const response = await fetch('https://api.nbp.pl/api/exchangerates/rates/c/eur/?format=json');
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const data = await response.json();
    // data.rates[0].ask is the selling rate
    return data?.rates?.[0]?.ask || null;
  } catch (error) {
    console.error("Failed to fetch NBP rate:", error);
    return null;
  }
};
