const path = require("path");
const { getContractNameFromScriptFileName } = require("../helpers/utils");
const hre = require("hardhat");
const {
    getStakingModulesNames,
    stakingRegisterModuleWithMultisig,
    sendWithMultisig,
    createProposal,
    multisigCheckTx,
    getStakingModuleContractToReplace,
} = require("../helpers/helpers");

const { arrayToUnique } = require("../helpers/utils");

const func = async function () {
    // ENTER NEW MODULES //
    const newModulesObject = {
        /*
        StakingAdminModule: "StakingAdminModule",
        StakingGovernanceModule: "StakingGovernanceModule",
        StakingStakeModule: "StakingStakeModule",
        StakingStorageModule: "StakingStorageModule",
        StakingVestingModule: "StakingVestingModule",
        StakingWithdrawModule: "StakingWithdrawModule",
        WeightedStakingModule: "WeightedStakingModule",
        */
    };

    // ENTER REGISTERED MODULES ADDRESSES TO REPLACE //
    // the order of the modules addresses doesn't matter
    const modulesToReplaceAddressList = [
        /*
       "0x0000000000000000000000000000000000000000",
       "0x0000000000000000000000000000000000000000"
       */
    ];

    if (
        !(
            modulesToReplaceAddressList.length != 0 &&
            modulesToReplaceAddressList.length == Object.keys(newModulesObject).length
        )
    ) {
        console.error(
            "WARNING! No modules replacement! newModulesObject and modulesToReplaceAddressList arrays must be set and their size equal"
        );
        return;
    }

    // PROCESS MODULES REPLACEMENT //
    const {
        deployments: { get, log },
        getNamedAccounts,
        ethers,
    } = hre;

    log("Replacing Staking Modules...");

    const stakingProxyDeployment = await get("StakingProxy");
    const stakingModulesProxyDeployment = await get("StakingModulesProxy"); //await ethers.getContract("StakingModulesProxy");
    // @dev stakingModulesProxy@stakingProxy
    const stakingModulesProxy = await ethers.getContractAt(
        stakingModulesProxyDeployment.abi,
        stakingProxyDeployment.address
    );

    const { deployer } = await getNamedAccounts();

    // get new modules addresses
    let newModulesDeployment = [];
    for (let moduleName in newModulesObject) {
        const moduleDeployment = await get(moduleName);
        newModulesDeployment.push({ name: moduleName, address: moduleDeployment.address });
    }
    const newModulesAddressList = Object.values(newModulesDeployment);

    // get registered modules list and compare to
    const computedModulesToBeReplaced = modulesToReplaceAddressList.map(async (el) => {
        const module = await getStakingModuleContractToReplace(el);
        if (module == ethers.constants.AddressZero) {
            throw new Error(
                `Module ${module} is not replacing any registered module (no func sigs found in registered modules) - must be added instead`
            );
        }
        return module;
    });

    // validate modules to replace addresses
    if (
        JSON.stringify(computedModulesToBeReplaced.sort()).toLowerCase() !=
        JSON.stringify(modulesToReplaceAddressList.sort()).toLowerCase()
    ) {
        log(`addresses computed: \n${computedModulesToBeReplaced.sort()}`);
        log(`addresses provided: \n${modulesToReplaceAddressList.sort()}`);
        throw new Error("Addresses of modules to replace are invalid");
    }

    const stakingModulesProxyInterface = new ethers.utils.Interface(
        stakingModulesProxyDeployment.abi
    );
    if (hre.network.tags["testnet"]) {
        // @todo wrap into a helper multisig tx creation
        const multisigDeployment = await get("MultiSigWallet");
        let data = stakingModulesProxyInterface.encodeFunctionData("replaceModules", [
            computedModulesToBeReplaced,
            newModulesAddressList,
        ]);
        log("Generating multisig transaction to replace modules...");
        await sendWithMultisig(multisigDeployment.address, tx.address, data, deployer);
        log("Done. Required to execute the generated multisig txs to complete registration.");
    } else if (hre.network.tags["mainnet"]) {
        //owned by governance - need a SIP to register
        // TODO: implementation ; meanwhile use brownie sip_interaction scripts to create proposal
        // TODO: figure out if possible to pass SIP via environment and run the script
        //const stakingProxyDeployment = await get("StakingProxy");
        log("Staking modules and StakingModuleProxy are deployed (reused the ones not changed)");
        log("Prepare and run SIP function in sips.js to create the proposal");
    } else {
        // hh ganache
        await stakingModulesProxy.replaceModules(
            computedModulesToBeReplaced,
            newModulesAddressList
        );
    }
};
func.tags = ["ReplaceStakingModules"]; // getContractNameFromScriptFileName(path.basename(__filename))
func.dependencies = ["StakingModulesProxy", "StakingModules"];
module.exports = func;
