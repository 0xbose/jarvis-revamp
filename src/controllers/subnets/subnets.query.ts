import { SubnetItem } from "@/types/subnet";
import axios from "axios";
import { API_CONFIG } from "@/config/constants";
	
export const getSubnetsByID = async (id: string): Promise<SubnetItem[]> => {
	if (!id) {
		throw new Error("ID is required");
	}
	const response = await axios.get(
		`${API_CONFIG.API_BASE_URL}/subnets/${id}`,
		{
			headers: {
				"x-api-key": `${API_CONFIG.X_API_KEY}`,
			},
		}
	);
	return response.data.data;
};
