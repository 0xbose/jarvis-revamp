import { SubnetItem } from "@/types/subnet";
import axios from "axios";

export const getSubnetsByID = async (id: string): Promise<SubnetItem[]> => {
	if (!id) {
		throw new Error("ID is required");
	}
	const response = await axios.get(
		`${process.env.NEXT_PUBLIC_API_BASE_URL}/subnets/${id}`,
		{
			headers: {
				"x-api-key": `${process.env.NEXT_PUBLIC_X_API_KEY}`,
			},
		}
	);
	return response.data.data;
};
