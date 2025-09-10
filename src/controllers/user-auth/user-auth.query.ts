import { Web3Context } from "@/types/wallet";
import SkyMainBrowser from "@decloudlabs/skynet/lib/services/SkyMainBrowser";
import { getAxiosInstanceWithApiKey } from "@/lib/axios";

export const getAgentUserAuthStatus = async ({
	subnetUrl,
	agentCollection,
	skyBrowser,
	web3Context,
}: {
	subnetUrl: string;
	agentCollection: any;
	skyBrowser: SkyMainBrowser;
	web3Context: Web3Context;
}): Promise<any> => {
	const axiosInstance = await getAxiosInstanceWithApiKey(
		subnetUrl,
		skyBrowser,
		web3Context
	);

	const response = await axiosInstance.post(`${subnetUrl}/auth-status`, {
		agentCollection: agentCollection,
	});
	return response.data;
};
