const ViewToken = artifacts.require('ViewToken');
const ViewTokenCrowdsale = artifacts.require('ViewTokenCrowdsale');

contract('ViewTokenCrowdsale', ([, wallet]) => {

  beforeEach(async () => {

    // this.token = await ViewToken.deployed();
    // this.tokenSale = await ViewTokenCrowdsale.deployed();

    // Token config
    this.name = 'View';
    this.symbol = 'VTK';
    this.decimals = 18;
    this.token = await ViewToken.new(
      this.name,
      this.symbol,
      this.decimals);
    
    // Token crowdsale config
    this.rate = 500; // 500 View tokens for 1 ether
    this.wallet = wallet;
    this.tokenSale = await ViewTokenCrowdsale.new(
      this.rate,
      this.wallet,
      this.token.address
    );
  });

  describe('crowdsale', () => {
    it('tracks the token', async () => {
      const token = await this.tokenSale.token();
      assert.equal(token, this.token.address, 'Deployed token should be correct.');
    });

    it('tracks the rate', async () => {
      const rate = await this.tokenSale.rate();
      assert(rate, this.rate, 'Rate should be correct');
    });

    it('tracks the wallet', async () => {
      const wallet = await this.tokenSale.wallet();
      assert(wallet, this.wallet, 'Wallet should be correct');
    });
  });
});
