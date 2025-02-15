import * as dotenv from 'dotenv'

import { 
    SafeAccountV0_3_0,
    MetaTransaction,
    calculateUserOperationMaxGasCost,
    getFunctionSelector,
    createCallData,
    Bundler
} from "abstractionkit";

async function main(): Promise<void> {
    //get values from .env
    dotenv.config()
    const chainId = BigInt(process.env.CHAIN_ID as string)
    const bundlerUrl = process.env.BUNDLER_URL as string
    const jsonRpcNodeProvider = process.env.JSON_RPC_NODE_PROVIDER as string
    const ownerPublicAddress = process.env.PUBLIC_ADDRESS as string
    const ownerPrivateKey = process.env.PRIVATE_KEY as string

    //initializeNewAccount only needed when the smart account
    //have not been deployed yet for its first useroperation.
    //You can store the accountAddress to use it to initialize 
    //the SafeAccount object for the following useroperations
    let smartAccount = SafeAccountV0_3_0.initializeNewAccount(
        [ownerPublicAddress],
    )

    //After the account contract is deployed, no need to call initializeNewAccount
    //let smartAccount = new SafeAccount(accountAddress)

    console.log("Account address(sender) : " + smartAccount.accountAddress)

    //create two meta transaction to mint two NFTs
    //you can use favorite method (like ethers.js) to construct the call data 
    const nftContractAddress = "0x9a7af758aE5d7B6aAE84fe4C5Ba67c041dFE5336";
    const mintFunctionSignature =  'mint(address)';
    const mintFunctionSelector =  getFunctionSelector(mintFunctionSignature);
    console.log("mintFunctionSelector ", mintFunctionSelector)
    const mintTransactionCallData = createCallData(
        mintFunctionSelector, 
        ["address"],
        ["0x2f3675Be2999325826e05C8c2178a615d756748d"]
    );
    const transaction1 :MetaTransaction ={
        to: nftContractAddress,
        value: 0n,
        data: mintTransactionCallData,
    }

    const transaction2 :MetaTransaction ={
        to: nftContractAddress,
        value: 0n,
        data: mintTransactionCallData,
    }

    //createUserOperation will determine the nonce, fetch the gas prices,
    //estimate gas limits and return a useroperation to be signed.
    //you can override all these values using the overrides parameter.
    let userOperation = await smartAccount.createUserOperation(
		[
            //You can batch multiple transactions to be executed in one useroperation.
            transaction1, transaction2,
        ],
        jsonRpcNodeProvider, //the node rpc is used to fetch the current nonce and fetch gas prices.
        bundlerUrl, //the bundler rpc is used to estimate the gas limits.
        //uncomment the following values for polygon or any chains where
        //gas prices change rapidly
        {
        //    verificationGasLimitPercentageMultiplier:130
        //    maxFeePerGasPercentageMultiplier:130,
        //    maxPriorityFeePerGasPercentageMultiplier:130
        }
	)
    const cost = calculateUserOperationMaxGasCost(userOperation)
    console.log("This useroperation may cost upto : " + cost + " wei")
    console.log(
        "Please fund the sender account : " + 
        userOperation.sender +
        " with more than " + cost + " wei"
    )
 
    //Safe is a multisig that can have multiple owners/signers
    //signUserOperation will create a signature for the provided
    //privateKeys
    userOperation.signature = smartAccount.signUserOperation(
		userOperation,
        [ownerPrivateKey],
        chainId
	)
    console.log(userOperation)

    //use the bundler rpc to send a userOperation
    //sendUserOperation will return a SendUseroperationResponse object
    //that can be awaited for the useroperation to be included onchain
    const sendUserOperationResponse = await smartAccount.sendUserOperation(
        userOperation, bundlerUrl
    )

    console.log("Useroperation sent. Waiting to be included ......")
    //included will return a UserOperationReceiptResult when 
    //useroperation is included onchain
    let userOperationReceiptResult = await sendUserOperationResponse.included()

    console.log("Useroperation receipt received.")
    console.log(userOperationReceiptResult)
    if(userOperationReceiptResult.success){
        console.log("Two Nfts were minted. The transaction hash is : " + userOperationReceiptResult.receipt.transactionHash)
    }else{
        console.log("Useroperation execution failed")
    }
}

main()