import React from "react";

const layout = ({ children }: { children: React.ReactNode }) => {
	return (
		<div className="container mx-auto overflow-y-hidden max-w-7xl md:px-6 pt-6 ">{children}</div>
	);
};

export default layout;
