export interface SubnetItem {
	subnet_id: number;
	subnet_name: string;
	description: string;
	input_description: string;
	output_description: string;
	prompt_example: string;
	file_upload: boolean;
	file_download: boolean;
	subnet_url: string;
	created_at: string;
	updated_at: string;
	expected_input: any | null;
	expected_output: any | null;
	unique_id: string;
	input_type: string;
	output_type: string;
	auth_required: boolean;
	supports_rabbitmq: boolean;
}

export interface ExtendedSubnet extends SubnetItem {
	itemID?: number;
}
