require('chai')
  .use(require('chai-bignumber')(BigNumber))
  .should();

const ViewToken = artifacts.require('ViewToken');

contract('ViewToken', (accounts) => {

  beforeEach(async () => {
    this.token = await ViewToken.new(_name, _symbol, _decimals)
  });

});
