module.exports = {
	name: "redis",
	commands: {
		"hget": {
			description: "Returns args as result",
			run: function(ctx, args) {
				return Promise.resolve(args);
			},
			expect: function(ctx, args, res) {
				return [];
			}
		}
	}
};