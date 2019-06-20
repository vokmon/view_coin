// Returns the time of the last mined block in seconds
export default async function latestTime () {
  const latest = await web3.eth.getBlock('latest');
  return latest.timestamp;
}