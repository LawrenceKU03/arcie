const index = () => {
	return (
		<box>
			<box
				justifyContent="center"
				alignItems="center"
				flexDirection="row"
				border
				borderStyle="rounded"
				borderColor="white"
				title="Welcome to Basecode by cencori"
				paddingX={4}
				paddingY={2}
				gap={0.5}
			>
				<ascii-font font="block" text="BASE" color="gray" />
				<ascii-font font="block" text="CODE" />
				<text marginX={"auto"}>v0.1.0</text>
			</box>
		</box>
	);
};

export default index;
