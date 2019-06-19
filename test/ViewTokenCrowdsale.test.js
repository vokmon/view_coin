import ether from './helper/ether';
import { AssertionError } from 'assert';

const BigNumber = web3.BigNumber;
require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

const ViewToken = artifacts.require('ViewToken');
const ViewTokenCrowdsale = artifacts.require('ViewTokenCrowdsale');

contract('ViewTokenCrowdsale', function([_, wallet, investor1, investor2]) {

  beforeEach(async function() {

    // this.token = await ViewToken.deployed();
    // this.crowdsale = await ViewTokenCrowdsale.deployed();

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
    this.crowdsale = await ViewTokenCrowdsale.new(
      this.rate,
      this.wallet,
      this.token.address
    );

    // only ViewToken can mint the coin so we
    // need to add minter role to crowdsale to mint the coin
    await this.token.addMinter(this.crowdsale.address);
  });

  describe('crowdsale', function() {
    it('tracks the token', async function() {
      const token = await this.crowdsale.token();
      token.should.equal(this.token.address);
    });

    it('tracks the rate', async function() {
      const rate = await this.crowdsale.rate();
      rate.toNumber().should.equal(this.rate);
    });

    it('tracks the wallet', async function() {
      const wallet = await this.crowdsale.wallet();
      wallet.should.equal(this.wallet);
    });
  });
  
  describe('minted crowdsale', function() {
    it('mints tokens after purchase', async function() {
      const originalTotalSupply = await this.token.totalSupply();
      await this.crowdsale.sendTransaction({value: ether(1), from: investor1});
      const newTotalSupply = await this.token.totalSupply();
      assert.isTrue(originalTotalSupply < newTotalSupply);
    });
  });

  describe('accepting payments', function() {
    it('should accept payments', async function() {
      const value = ether(1);
      await this.crowdsale.sendTransaction({ value, from: investor1})
      .should.be.fulfilled;

      // investor1 buy tokens on behalf of purchaser
      const purchaser = investor2;
      await this.crowdsale.buyTokens(investor1, {value, from: purchaser})
      .should.be.fulfilled;
    });
  });
});
