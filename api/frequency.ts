export const config = { runtime: "edge" };

export default async function handler() {
  const response = await fetch(
    "https://driftsdata.statnett.no/restapi/Frequency/BySecond?From=2012-01-01"
  );
  const data = await response.text();

  return new Response(data, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, s-maxage=5",
    },
  });
}
